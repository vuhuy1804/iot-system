from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, or_
import math

from database import get_db
from models import Device, ActionHistory, User
from schemas import DeviceControlSchema
from mqtt_client import publish_command

router = APIRouter()

@router.get("/")
async def get_devices(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device))
    devices = result.scalars().all()
    return [{"id": d.id, "name": d.name, "status": d.status == "ON"} for d in devices]

@router.post("/control")
async def control_device(data: DeviceControlSchema, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Device).filter(Device.id == data.device_id))
    device = result.scalars().first()
    if not device:
        raise HTTPException(status_code=404, detail="Không tìm thấy thiết bị")

    device.status = data.action
    led_code = "led1" if device.id == 1 else "led2"
    payload = f"{led_code}:{data.action.lower()}"
    
    # Gửi lệnh điều khiển tới Mosquitto Broker
    publish_command("device/control", payload)

    # Ghi nhận lịch sử thao tác vào MySQL
    action_log = ActionHistory(
        user_id=1,
        device_id=device.id,
        action="Bật đèn" if data.action == "ON" else "Tắt đèn",
        status="Thành công"
    )
    db.add(action_log)
    await db.commit()

    return {"success": True, "message": f"Đã gửi lệnh {payload}"}

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