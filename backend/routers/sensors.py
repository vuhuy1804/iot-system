from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import desc, func, String
from database import get_db
from models import DataSensor, Sensor
from datetime import date

router = APIRouter()

@router.get(
    "/latest", 
    summary="Lấy chỉ số Cảm biến Mới nhất & Giá trị Cao nhất",
    responses={
        200: {
            "description": "Số liệu Nhiệt độ, Độ ẩm, Ánh sáng hiện tại và đỉnh trong ngày.",
            "content": {
                "application/json": {
                    "example": {
                        "temperature": {"current": 29.5, "max_today": 35.0, "unit": "°C"},
                        "humidity": {"current": 60.0, "max_today": 70.0, "unit": "%"},
                        "light": {"current": 500.0, "max_today": 800.0, "unit": "lux"}
                    }
                }
            }
        }
    }
)
async def get_latest_sensors(db: AsyncSession = Depends(get_db)):
    """
    **Truy vấn Giá trị Cảm biến Realtime cho Stat Cards**:
    - Lấy bản ghi đo đạc mới nhất của Nhiệt độ (ID=1), Độ ẩm (ID=2), Ánh sáng (ID=3).
    - Tính toán giá trị MAX trong ngày của từng loại cảm biến.
    """
    latest_temp = await db.execute(
        select(DataSensor.value).filter(DataSensor.sensor_id == 1).order_by(desc(DataSensor.recorded_at)).limit(1)
    )
    latest_hum = await db.execute(
        select(DataSensor.value).filter(DataSensor.sensor_id == 2).order_by(desc(DataSensor.recorded_at)).limit(1)
    )
    latest_lux = await db.execute(
        select(DataSensor.value).filter(DataSensor.sensor_id == 3).order_by(desc(DataSensor.recorded_at)).limit(1)
    )

    max_temp = await db.execute(
        select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 1, func.date(DataSensor.recorded_at) == date.today())
    )
    max_hum = await db.execute(
        select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 2, func.date(DataSensor.recorded_at) == date.today())
    )
    max_lux = await db.execute(
        select(func.max(DataSensor.value)).filter(DataSensor.sensor_id == 3, func.date(DataSensor.recorded_at) == date.today())
    )

    temp_val = latest_temp.scalar() or 0.0
    hum_val = latest_hum.scalar() or 0.0
    lux_val = latest_lux.scalar() or 0.0

    return {
        "temperature": {"current": temp_val, "max_today": max_temp.scalar() or temp_val, "unit": "°C"},
        "humidity": {"current": hum_val, "max_today": max_hum.scalar() or hum_val, "unit": "%"},
        "light": {"current": lux_val, "max_today": max_lux.scalar() or lux_val, "unit": "lux"}
    }


@router.get(
    "/chart-history", 
    summary="Lấy dữ liệu Lịch sử vẽ Biểu đồ Dashboard",
    responses={
        200: {
            "description": "Danh sách các mốc thời gian kèm thông số cảm biến phục vụ Recharts.",
            "content": {
                "application/json": {
                    "example": [
                        {"time": "10:05:20", "temp": 28.5, "hum": 60.0, "lux": 500.0},
                        {"time": "10:05:22", "temp": 29.5, "hum": 61.0, "lux": 510.0}
                    ]
                }
            }
        }
    }
)
async def get_chart_history(db: AsyncSession = Depends(get_db)):
    """
    **Truy vấn Dữ liệu Vẽ Biểu đồ Thời gian thực**:
    - Lấy 36 bản ghi mới nhất (12 mốc thời gian x 3 loại cảm biến).
    - Nhóm dữ liệu theo chuỗi giờ `HH:MM:SS`.
    """
    result = await db.execute(
        select(DataSensor, Sensor.name)
        .join(Sensor, DataSensor.sensor_id == Sensor.id)
        .order_by(desc(DataSensor.recorded_at))
        .limit(36)
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

    return list(time_map.values())


@router.get(
    "/history", 
    summary="Tra cứu Lịch sử Dữ liệu Cảm biến (Phân trang & Lọc)",
    responses={
        200: {
            "description": "Mảng bản ghi cảm biến kèm thông tin tổng số lượng và số trang.",
            "content": {
                "application/json": {
                    "example": {
                        "data": [
                            {
                                "id": 105,
                                "type": "Nhiệt độ",
                                "value": "29.5 °C",
                                "numValue": 29.5,
                                "time": "2026-10-25 10:05:22"
                            }
                        ],
                        "total": 120,
                        "page": 1,
                        "totalPages": 12
                    }
                }
            }
        }
    }
)
async def get_sensor_history(
    page: int = Query(1, ge=1, description="Số trang cần xem (bắt đầu từ 1)", example=1),
    limit: int = Query(10, ge=1, description="Số lượng bản ghi trên một trang", example=10),
    category: str = Query("Tất cả", description="Chế độ lọc: 'Tất cả', 'Thời gian', 'Nhiệt độ', 'Độ ẩm', 'Ánh sáng'"),
    search: str = Query("", description="Từ khóa giá trị hoặc mốc thời gian (VD: '14', '2026-10-25')"),
    sortBy: str = Query("time_desc", description="Tiêu chí sắp xếp: 'time_desc', 'time_asc', 'val_asc', 'val_desc'"),
    db: AsyncSession = Depends(get_db)
):
    """
    **Tra cứu Lịch sử Cảm biến (Trang Data Sensor)**:
    - Tìm kiếm giá trị số theo tiền tố (`14%`) giúp khớp đầu số chính xác.
    - Phân trang bất đồng bộ bằng `LIMIT / OFFSET` trên CSDL MySQL.
    """
    query = select(DataSensor, Sensor.name, Sensor.unit).join(
        Sensor, DataSensor.sensor_id == Sensor.id
    )

    trimmed_search = search.strip()
    if trimmed_search:
        contains_term = f"%{trimmed_search}%"
        prefix_term = f"{trimmed_search}%"

        if category == "Thời gian":
            query = query.filter(DataSensor.recorded_at.cast(String).like(contains_term))
        elif category in ["Nhiệt độ", "Độ ẩm", "Ánh sáng"]:
            query = query.filter(
                Sensor.name == category,
                DataSensor.value.cast(String).like(prefix_term)
            )
        else:
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