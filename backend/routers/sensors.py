from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func, String
from database import get_db
from models import DataSensor, Sensor, AlertHistory
from datetime import date

router = APIRouter()

@router.get("/latest")
async def get_latest_sensors(db: AsyncSession = Depends(get_db)):
    latest_temp = await db.execute(select(DataSensor.value).filter(DataSensor.sensor_id == 1).order_by(desc(DataSensor.recorded_at)).limit(1))
    latest_hum = await db.execute(select(DataSensor.value).filter(DataSensor.sensor_id == 2).order_by(desc(DataSensor.recorded_at)).limit(1))
    latest_lux = await db.execute(select(DataSensor.value).filter(DataSensor.sensor_id == 3).order_by(desc(DataSensor.recorded_at)).limit(1))
    latest_wind = await db.execute(select(DataSensor.value).filter(DataSensor.sensor_id == 4).order_by(desc(DataSensor.recorded_at)).limit(1))

    max_temp = await db.execute(select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 1, func.date(DataSensor.recorded_at) == date.today()))
    max_hum = await db.execute(select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 2, func.date(DataSensor.recorded_at) == date.today()))
    max_lux = await db.execute(select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 3, func.date(DataSensor.recorded_at) == date.today()))
    max_wind = await db.execute(select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 4, func.date(DataSensor.recorded_at) == date.today()))

    temp_val = latest_temp.scalar() or 0.0
    hum_val = latest_hum.scalar() or 0.0
    lux_val = latest_lux.scalar() or 0.0
    wind_val = latest_wind.scalar() or 0.0

    return {
        "temperature": {"current": temp_val, "max_today": max_temp.scalar() or temp_val, "unit": "°C"},
        "humidity": {"current": hum_val, "max_today": max_hum.scalar() or hum_val, "unit": "%"},
        "light": {"current": lux_val, "max_today": max_lux.scalar() or lux_val, "unit": "lux"},
        "wind_speed": {"current": wind_val, "max_today": max_wind.scalar() or wind_val, "unit": "m/s"}
    }


@router.get("/chart-history")
async def get_chart_history(db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(DataSensor, Sensor.name)
        .join(Sensor, DataSensor.sensor_id == Sensor.id)
        .order_by(desc(DataSensor.recorded_at))
        .limit(48)
    )
    rows = result.all()

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
        elif sensor_name == "wind-speed" or sensor_name == "Tốc độ gió":
            time_map[time_str]["wind"] = ds.value

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
   
    query = select(DataSensor, Sensor.name, Sensor.unit).join(
        Sensor, DataSensor.sensor_id == Sensor.id
    )

    trimmed_search = search.strip()
    if trimmed_search:
        contains_term = f"%{trimmed_search}%"
        prefix_term = f"{trimmed_search}%"

        if category == "Thời gian":
            query = query.filter(DataSensor.recorded_at.cast(String).like(contains_term))
        elif category in ["Nhiệt độ", "Độ ẩm", "Ánh sáng", "wind-speed"]:
            query = query.filter(
                Sensor.name == category,
                DataSensor.value.cast(String).like(prefix_term)
            )
        elif category == "Tốc độ gió":
            query = query.filter(
                Sensor.name == "wind-speed",
                DataSensor.value.cast(String).like(prefix_term)
            )
        else:
            # Chế độ "Tất cả": Tìm kiếm trên tất cả các cột
            query = query.filter(
                (Sensor.name.like(contains_term)) |
                (DataSensor.value.cast(String).like(prefix_term)) |
                (DataSensor.recorded_at.cast(String).like(contains_term))
            )

    if sortBy == "time_asc":
        query = query.order_by(DataSensor.recorded_at.asc())
    elif sortBy == "val_asc":
        query = query.order_by(DataSensor.value.asc())
    elif sortBy == "val_desc":
        query = query.order_by(DataSensor.value.desc())
    else:
        query = query.order_by(DataSensor.recorded_at.desc())

    total_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(total_query)
    total_count = total_result.scalar() or 0
    total_pages = max(1, (total_count + limit - 1) // limit)

    offset = (page - 1) * limit
    query = query.offset(offset).limit(limit)

    result = await db.execute(query)
    rows = result.all()

    formatted_data = []
    for ds, sensor_name, sensor_unit in rows:
        formatted_data.append({
            "id": ds.id,
            "type": sensor_name,
            "value": f"{ds.value} {sensor_unit or ''}".strip(),
            "numValue": ds.value,
            "time": ds.recorded_at.strftime("%Y-%m-%d %H:%M:%S")
        })

    return {
        "data": formatted_data,
        "total": total_count,
        "page": page,
        "totalPages": total_pages
    }


@router.get("/alerts/monthly")
async def get_monthly_alerts(db: AsyncSession = Depends(get_db)):
    today = date.today()
    start_date = today.replace(day=1)

    result = await db.execute(
        select(
            func.date(AlertHistory.recorded_at).label("alert_date"),
            func.count(AlertHistory.id).label("count")
        )
        .filter(AlertHistory.recorded_at >= start_date)
        .group_by(func.date(AlertHistory.recorded_at))
        .order_by(func.date(AlertHistory.recorded_at))
    )
    
    rows = result.all()
    
    chart_data = [
        {"date": str(row.alert_date), "count": row.count}
        for row in rows
    ]
    return chart_data