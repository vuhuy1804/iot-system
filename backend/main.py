import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from database import engine, Base
import models

from routers import auth, sensors, devices
from mqtt_client import setup_mqtt, set_event_loop

# Định nghĩa Tags Metadata phân nhóm Swagger UI
tags_metadata = [
    {
        "name": "Auth",
        "description": "Xác thực người dùng và Quản lý thông tin Hồ sơ cá nhân (Profile).",
    },
    {
        "name": "Sensors",
        "description": "Truy vấn chỉ số Cảm biến thời gian thực, Lịch sử biểu đồ và Tra cứu nhật ký đo đạc.",
    },
    {
        "name": "Devices",
        "description": "Điều khiển thiết bị phần cứng (Bật/Tắt Đèn LED) qua MQTT và Tra cứu Lịch sử thao tác (ActionHistory).",
    },
]

app = FastAPI(
    title="IoT Environmental Monitoring & Control API Docs",
    description="""
### IOT VÀ ỨNG DỤNG

---
#### Architecture Overview:
- **Backend:** FastAPI (Python) + Async SQLAlchemy + MySQL + Mosquitto MQTT Broker.
- **Frontend:** ReactJS (Vite) + Tailwind CSS + Recharts + WebSockets.
- **Hardware:** ESP32 Microcontroller + DHT11 (Temp/Hum) + BH1750 (Lux) + 2-Channel Relay.
    """,
    version="1.0.0",
    openapi_tags=tags_metadata,
    contact={
        "name": "Vũ Quang Huy",
        "email": "HuyVQ.B23CN412@stu.ptit.edu.vn",
    },
)

app.mount("/static", StaticFiles(directory="static"), name="static")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            try:
                await connection.send_json(message)
            except Exception:
                pass

manager = ConnectionManager()

@app.on_event("startup")
async def startup_event():
    loop = asyncio.get_running_loop()
    set_event_loop(loop)
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
    setup_mqtt()

app.include_router(auth.router, prefix="/api/auth", tags=["Auth"])
app.include_router(sensors.router, prefix="/api/sensors", tags=["Sensors"])
app.include_router(devices.router, prefix="/api/devices", tags=["Devices"])

@app.websocket("/ws/dashboard")
async def websocket_endpoint(websocket: WebSocket):
    """
    **WebSocket Realtime Service**:
    - Nhận phát sóng tự động `SENSOR_UPDATE` khi có dữ liệu mới từ ESP32.
    - Nhận phát sóng `DEVICE_UPDATE` xác nhận trạng thái phần cứng thực tế.
    """
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

@app.get("/", summary="Kiểm tra trạng thái máy chủ (Health Check)", tags=["Health"])
def root():
    """Kiểm tra phản hồi nhanh từ máy chủ FastAPI Backend."""
    return {"status": "ok", "message": "Backend FastAPI Running!"}