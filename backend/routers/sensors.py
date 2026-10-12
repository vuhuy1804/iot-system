from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func
from database import get_db
from models import DataSensor, Sensor

router = APIRouter()

@router.get("/latest")
async def get_latest_sensors(db: AsyncSession = Depends(get_db)):
    # 1. Lấy chỉ số mới nhất cho từng cảm biến
    latest_temp = await db.execute(
        select(DataSensor.value).filter(DataSensor.sensor_id == 1).order_by(desc(DataSensor.recorded_at)).limit(1)
    )
    latest_hum = await db.execute(
        select(DataSensor.value).filter(DataSensor.sensor_id == 2).order_by(desc(DataSensor.recorded_at)).limit(1)
    )
    latest_lux = await db.execute(
        select(DataSensor.value).filter(DataSensor.sensor_id == 3).order_by(desc(DataSensor.recorded_at)).limit(1)
    )

    # 2. Lấy giá trị lớn nhất hôm nay
    max_temp = await db.execute(
        select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 1)
    )
    max_hum = await db.execute(
        select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 2)
    )
    max_lux = await db.execute(
        select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 3)
    )

    temp_val = latest_temp.scalar() or 0.0
    hum_val = latest_hum.scalar() or 0.0
    lux_val = latest_lux.scalar() or 0.0

    return {
        "temperature": {"current": temp_val, "max_today": max_temp.scalar() or temp_val, "unit": "°C"},
        "humidity": {"current": hum_val, "max_today": max_hum.scalar() or hum_val, "unit": "%"},
        "light": {"current": lux_val, "max_today": max_lux.scalar() or lux_val, "unit": "lux"}
    }

@router.get("/chart-history")
async def get_chart_history(db: AsyncSession = Depends(get_db)):
    # Lấy 36 bản ghi mới nhất (12 điểm x 3 loại cảm biến)
    result = await db.execute(
        select(DataSensor, Sensor.name)
        .join(Sensor, DataSensor.sensor_id == Sensor.id)
        .order_by(desc(DataSensor.recorded_at))
        .limit(36)
    )
    rows = result.all()

    # Nhóm dữ liệu theo mốc thời gian HH:MM:SS
    time_map = {}
    for ds, sensor_name in reversed(rows):
        time_str = ds.recorded_at.strftime("%H:%M:%S")
        if time_str not in time_map:
            time_map[time_str] = {"time": time_str}
        
        if sensor_name == "Nhiệt độ":
            time_map[time_str]["temp"] = ds.value
        elif sensor_name == "Độ ẩm":
            time_map[time_str]["hum"] = ds.value
        elif sensor_name == "Ánh sáng":
            time_map[time_str]["lux"] = ds.value

    return list(time_map.values())

@router.get("/history")
async def get_sensor_history(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    category: str = Query("Tất cả"),
    search: str = Query(""),
    sortBy: str = Query("time_desc"),
    db: AsyncSession = Depends(get_db)
):
    # 1. Truy vấn Join bảng DataSensor và Sensor
    query = select(DataSensor, Sensor.name, Sensor.unit).join(
        Sensor, DataSensor.sensor_id == Sensor.id
    )

    # 2. Lọc theo Loại Cảm biến (Category)
    if category != "Tất cả":
        query = query.filter(Sensor.name == category)

    # 3. Lọc theo từ khóa Tìm kiếm (Search)
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (Sensor.name.like(search_term)) |
            (DataSensor.value.cast(String).like(search_term)) |
            (DataSensor.recorded_at.cast(String).like(search_term))
        )

    # 4. Sắp xếp (Sort)
    if sortBy == "time_asc":
        query = query.order_by(DataSensor.recorded_at.asc())
    elif sortBy == "val_asc":
        query = query.order_by(DataSensor.value.asc())
    elif sortBy == "val_desc":
        query = query.order_by(DataSensor.value.desc())
    else:  # time_desc
        query = query.order_by(DataSensor.recorded_at.desc())

    # 5. Tính tổng số bản ghi (Phân trang)
    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total_count = total_result.scalar() or 0
    total_pages = max(1, (total_count + limit - 1) // limit)

    # 6. Phân trang LIMIT / OFFSET
    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    # 7. Định dạng mảng trả về khớp 100% với props React trong DataHistory.jsx
    formatted_data = []
    for ds, sensor_name, sensor_unit in rows:
        formatted_data.append({
            "id": ds.id,
            "type": sensor_name,  # 'Nhiệt độ', 'Độ ẩm', 'Ánh sáng'
            "value": f"{ds.value} {sensor_unit or ''}".strip(),  # VD: '29.5 °C'
            "numValue": ds.value,
            "time": ds.recorded_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return {
        "data": formatted_data,
        "total": total_count,
        "page": page,
        "totalPages": total_pages
    }