import asyncio
import math
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc

from database import get_db
from models import Device, ActionHistory, User
from schemas import DeviceControlSchema
from mqtt_client import publish_command, register_pending_ack, unregister_pending_ack

# Import thêm hàm dependency get_current_user từ router auth
from routers.auth import get_current_user

router = APIRouter()

@router.get(
    "", 
    summary="Lấy danh sách Danh mục Thiết bị",
    responses={
        200: {
            "description": "Mảng thông tin tất cả thiết bị và trạng thái Bật/Tắt.",
            "content": {
                "application/json": {
                    "example": [
                        {"id": 1, "name": "Đèn led 1", "status": "OFF"},
                        {"id": 2, "name": "Đèn led 2", "status": "OFF"}
                    ]
                }
            }
        }
    }
)
async def get_devices(db: AsyncSession = Depends(get_db)):
    """Lấy danh sách thiết bị phần cứng để hiển thị nút công tắc trên Dashboard."""
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    return [{"id": d.id, "name": d.name, "status": d.status == "ON"} for d in devices]


@router.post(
    "/control", 
    summary="Điều khiển Thiết bị Phần cứng (Xác nhận MQTT ACK - Yêu cầu Đăng nhập)",
    responses={
        200: {
            "description": "Điều khiển thành công, phần cứng đã phản hồi ACK.",
            "content": {
                "application/json": {
                    "example": {
                        "success": True,
                        "message": "Điều khiển Đèn led 1 thành công (LED1: ON)"
                    }
                }
            }
        },
        401: {
            "description": "Chưa đăng nhập hoặc JWT Token không hợp lệ.",
            "content": {
                "application/json": {
                    "example": {"detail": "Token không hợp lệ hoặc đã hết hạn"}
                }
            }
        },
        404: {
            "description": "Không tìm thấy thiết bị trong CSDL.",
            "content": {
                "application/json": {
                    "example": {"detail": "Không tìm thấy thiết bị"}
                }
            }
        },
        504: {
            "description": "Timeout 3 giây: ESP32 không phản hồi hoặc ngoại tuyến.",
            "content": {
                "application/json": {
                    "example": {
                        "detail": "Thiết bị phần cứng (ESP32) không phản hồi hoặc đang ngoại tuyến (Timeout)!"
                    }
                }
            }
        }
    }
)
async def control_device(
    data: DeviceControlSchema, 
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user) # Lấy người dùng hiện tại từ JWT
):
    """
    **Luồng Điều khiển Hardware ACK & Bảo mật**:
    1. Xác thực JWT Token qua `current_user` (Nếu không có Token sẽ lập tức trả về 401 Unauthorized).
    2. Lưu nhật ký `ActionHistory` trạng thái `PENDING` kèm `user_id` chính xác của người đang đăng nhập.
    3. Gửi lệnh qua MQTT topic `device/control`.
    4. Chờ ESP32 kích hoạt rơ-le và bắn phản hồi lên `device/status` (Max 3s).
    5. Cập nhật trạng thái `Thành công` / `Thất bại` vào MySQL và phát WebSocket.
    """
    result = await db.execute(select(Device).filter(Device.id == data.device_id))
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")

    action_text = "Bật đèn" if data.action == "ON" else "Tắt đèn"
    
    action_log = ActionHistory(
        user_id=current_user.id,
        device_id=device.id,
        action=action_text,
        status="PENDING"
    )
    db.add(action_log)
    await db.commit()
    await db.refresh(action_log)

    # ĐỊNH DẠNG MÃ ĐÈN LINH HOẠT CHÔ CẢ LED 1, LED 2 VÀ LED 3
    led_code = f"led{device.id}" # Sẽ sinh ra 'led1', 'led2', 'led3'
    payload = f"{led_code}:{data.action.lower()}"

    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    register_pending_ack(led_code, fut)

    try:
        publish_command("device/control", payload)
        ack_payload = await asyncio.wait_for(fut, timeout=3.0)

        if data.action.upper() in ack_payload.upper():
            device.status = data.action
            action_log.status = "Thành công"
            await db.commit()

            from main import manager
            await manager.broadcast({
                "type": "DEVICE_UPDATE",
                "data": {
                    "device_id": device.id,
                    "status": device.status,
                    "is_success": True
                }
            })

            return {"success": True, "message": f"Điều khiển {device.name} thành công ({ack_payload})"}
        else:
            action_log.status = "Thất bại"
            await db.commit()
            raise HTTPException(status_code=400, detail=f"ESP32 phản hồi thất bại: {ack_payload}")

    except asyncio.TimeoutError:
        action_log.status = "Thất bại"
        await db.commit()
        raise HTTPException(status_code=504, detail="Thiết bị phần cứng (ESP32) không phản hồi!")
    finally:
        unregister_pending_ack(led_code)


@router.get(
    "/actions/history", 
    summary="Tra cứu Lịch sử Thao tác Thiết bị (Action History)",
    responses={
        200: {
            "description": "Danh sách nhật ký điều khiển thiết bị kèm người thực hiện và trạng thái.",
            "content": {
                "application/json": {
                    "example": {
                        "data": [
                            {
                                "id": 1,
                                "device": "Đèn led 1",
                                "action": "Bật đèn",
                                "user": "Vũ Quang Huy",
                                "status": "Thành công",
                                "time": "2026-10-25 10:14:55"
                            }
                        ],
                        "total": 45,
                        "page": 1,
                        "totalPages": 5
                    }
                }
            }
        }
    }
)
async def get_action_history(
    page: int = Query(1, ge=1, description="Trang hiện tại", example=1),
    limit: int = Query(10, ge=1, description="Số bản ghi trên mỗi trang", example=10),
    searchTime: str = Query("", description="Từ khóa lọc mốc thời gian (VD: '2026-10-25')"),
    device: str = Query("Tất cả", description="Lọc tên thiết bị ('Tất cả', 'Đèn led 1', 'Đèn led 2')"),
    action: str = Query("Tất cả", description="Lọc loại hành động ('Tất cả', 'Bật đèn', 'Tắt đèn')"),
    status: str = Query("Tất cả", description="Lọc trạng thái ('Tất cả', 'Thành công', 'Thất bại', 'Đang chờ')"),
    sortBy: str = Query("time_desc", description="Thứ tự sắp xếp: 'time_desc', 'time_asc'"),
    db: AsyncSession = Depends(get_db)
):
    """
    **Tra cứu Nhật ký Lịch sử Thao tác (Trang Action History)**:
    - Lấy thông tin Join giữa 3 bảng: `ActionHistory`, `Device` và `User`.
    """
    query = select(ActionHistory, Device.name, User.fullName, User.username)\
        .join(Device, ActionHistory.device_id == Device.id)\
        .join(User, ActionHistory.user_id == User.id)

    if device != "Tất cả":
        query = query.filter(Device.name == device)
    if action != "Tất cả":
        query = query.filter(ActionHistory.action == action)
    if status != "Tất cả":
        query = query.filter(ActionHistory.status == status)
    if searchTime:
        query = query.filter(ActionHistory.recorded_at.like(f"%{searchTime}%"))

    if sortBy == "time_desc":
        query = query.order_by(desc(ActionHistory.recorded_at))
    else:
        query = query.order_by(ActionHistory.recorded_at)

    result = await db.execute(query)
    rows = result.all()

    total = len(rows)
    total_pages = math.ceil(total / limit) if total > 0 else 1
    offset = (page - 1) * limit
    paginated_rows = rows[offset:offset + limit]

    data = [
        {
            "id": ah.id,
            "device": dev_name,
            "action": ah.action,
            "user": user_fullName or username,
            "status": ah.status,
            "time": ah.recorded_at.strftime("%Y-%m-%d %H:%M:%S")
        }
        for ah, dev_name, user_fullName, username in paginated_rows
    ]

    return {
        "data": data,
        "total": total,
        "page": page,
        "limit": limit,
        "totalPages": total_pages
    }