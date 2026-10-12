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

router = APIRouter()

@router.get("/")
async def get_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    return [{"id": d.id, "name": d.name, "status": d.status == "ON"} for d in devices]

@router.post("/control")
async def control_device(data: DeviceControlSchema, db: AsyncSession = Depends(get_db)):
    # 1. Tìm thiết bị trong CSDL
    result = await db.execute(select(Device).filter(Device.id == data.device_id))
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")

    action_text = "Bật đèn" if data.action == "ON" else "Tắt đèn"
    
    # 2. Ghi nhận lịch sử thao tác với trạng thái ban đầu PENDING
    action_log = ActionHistory(
        user_id=1,
        device_id=device.id,
        action=action_text,
        status="PENDING"
    )
    db.add(action_log)
    await db.commit()
    await db.refresh(action_log)

    led_code = "led1" if device.id == 1 else "led2"
    payload = f"{led_code}:{data.action.lower()}"

    # 3. Đăng ký Future để chờ phản hồi từ ESP32 qua MQTT topic device/status
    loop = asyncio.get_running_loop()
    fut = loop.create_future()
    register_pending_ack(led_code, fut)

    try:
        # 4. Gửi lệnh điều khiển tới Mosquitto Broker
        publish_command("device/control", payload)

        # 5. Chờ phản hồi từ ESP32 trong tối đa 3 GIÂY (Timeout)
        ack_payload = await asyncio.wait_for(fut, timeout=3.0)

        # 6. ESP32 phản hồi thành công (VD: "LED1: ON")
        if data.action.upper() in ack_payload.upper():
            device.status = data.action
            action_log.status = "Thành công"
            await db.commit()

            # Broadcast WebSocket cho Frontend
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
        # 7. Quá 3s không có phản hồi -> Cập nhật FAILED, giữ nguyên trạng thái cũ của thiết bị
        action_log.status = "Thất bại"
        await db.commit()
        
        raise HTTPException(
            status_code=504, 
            detail="Thiết bị phần cứng (ESP32) không phản hồi hoặc đang ngoại tuyến (Timeout)!"
        )
    finally:
        unregister_pending_ack(led_code)

@router.get("/actions/history")
async def get_action_history(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    searchTime: str = "",
    device: str = "Tất cả",
    action: str = "Tất cả",
    status: str = "Tất cả",
    sortBy: str = "time_desc",
    db: AsyncSession = Depends(get_db)
):
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