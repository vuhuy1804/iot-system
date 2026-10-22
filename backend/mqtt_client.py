import json
import asyncio
import paho.mqtt.client as mqtt
from database import AsyncSessionLocal
from models import DataSensor, AlertHistory, ActionHistory, Device
from sqlalchemy.future import select

mqtt_client = None
main_loop = None

pending_ack = {}

def set_event_loop(loop):
    global main_loop
    main_loop = loop

def register_pending_ack(dev_code: str, fut: asyncio.Future):
    pending_ack[dev_code.lower()] = fut

def unregister_pending_ack(dev_code: str):
    pending_ack.pop(dev_code.lower(), None)

def _safe_set_result(fut, result):
    if not fut.done():
        fut.set_result(result)

# Biến toàn cục theo dõi trạng thái Đèn LED 3
last_led3_state = "OFF"

async def process_sensor_payload(data):
    global last_led3_state
    try:
        raw_temp = data.get("temp") if data.get("temp") is not None else data.get("temperature")
        raw_hum = data.get("hum") if data.get("hum") is not None else data.get("humidity")
        raw_lux = data.get("lux") if data.get("lux") is not None else data.get("light")
        raw_wind = data.get("wind_speed") if data.get("wind_speed") is not None else data.get("wind")

        temp = float(raw_temp) if raw_temp is not None else None
        hum = float(raw_hum) if raw_hum is not None else None
        lux = float(raw_lux) if raw_lux is not None else None
        wind = float(raw_wind) if raw_wind is not None else None

        is_alert = (wind is not None and wind > 300.0)
        current_led3_state = "ON" if is_alert else "OFF"

        async with AsyncSessionLocal() as session:
            async with session.begin():
                if temp is not None:
                    session.add(DataSensor(sensor_id=1, value=temp))
                if hum is not None:
                    session.add(DataSensor(sensor_id=2, value=hum))
                if lux is not None:
                    session.add(DataSensor(sensor_id=3, value=lux))
                if wind is not None:
                    session.add(DataSensor(sensor_id=4, value=wind))
                
                # 1. Lưu bản ghi AlertHistory
                if is_alert:
                    session.add(AlertHistory(sensor_type="wind-speed", value=wind))

                # 2. TỰ ĐỘNG CẬP NHẬT TRẠNG THÁI & LƯU ACTION HISTORY CHO ĐÈN LED 3 KHI ĐỔI TRẠNG THÁI CẢNH BÁO
                if current_led3_state != last_led3_state:
                    # Cập nhật trạng thái Đèn 3 trong bảng Device
                    res = await session.execute(select(Device).filter(Device.id == 3))
                    dev3 = res.scalars().first()
                    if dev3:
                        dev3.status = current_led3_state

                    # Thêm lịch sử thao tác vào ActionHistory (user_id = 1 là sinh viên thực hiện)
                    action_name = "Bật đèn" if current_led3_state == "ON" else "Tắt đèn"
                    session.add(ActionHistory(
                        user_id=1,
                        device_id=3,
                        action=action_name,
                        status="Thành công"
                    ))
                    
                    last_led3_state = current_led3_state

        from main import manager
        await manager.broadcast({
            "type": "SENSOR_UPDATE",
            "data": {
                "temperature": temp,
                "humidity": hum,
                "light": lux,
                "wind_speed": wind,
                "is_alert": is_alert
            }
        })
    except Exception as e:
        print(f"❌ [DB/WS ERROR]: {e}")

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("✅ Mosquitto MQTT Broker Connected Successfully!")
        client.subscribe("sensor/data")
        client.subscribe("device/status")
    else:
        print(f"❌ MQTT Connection Failed with code: {rc}")

def on_message(client, userdata, msg):
    try:
        topic = msg.topic
        payload = msg.payload.decode("utf-8")

        if topic == "sensor/data":
            sensor_data = json.loads(payload)
            global main_loop
            if main_loop and main_loop.is_running():
                asyncio.run_coroutine_threadsafe(process_sensor_payload(sensor_data), main_loop)
            else:
                asyncio.run(process_sensor_payload(sensor_data))

        elif topic == "device/status":
            payload_str = payload.strip()
            if ":" in payload_str:
                dev_code = payload_str.split(":")[0].strip().lower()
                if dev_code in pending_ack:
                    fut = pending_ack[dev_code]
                    if main_loop and main_loop.is_running():
                        main_loop.call_soon_threadsafe(_safe_set_result, fut, payload_str)

    except Exception as e:
        print(f"❌ [MQTT PARSE ERROR]: {e}")

def setup_mqtt():
    global mqtt_client
    mqtt_client = mqtt.Client(client_id="fastapi_backend_server")
    mqtt_client.username_pw_set("vuhuy", "12345")
    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    try:
        mqtt_client.connect("127.0.0.1", 1880, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"⚠️ MQTT Start Error: {e}")

def publish_command(topic: str, payload: str):
    global mqtt_client
    if mqtt_client:
        mqtt_client.publish(topic, payload)