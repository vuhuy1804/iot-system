import json
import asyncio
import paho.mqtt.client as mqtt
from database import AsyncSessionLocal
from models import DataSensor

mqtt_client = None
main_loop = None

def set_event_loop(loop):
    global main_loop
    main_loop = loop

# Hàm xử lý Async: Lưu MySQL + WebSocket Broadcast
async def process_sensor_payload(data):
    try:
        # Lấy giá trị linh hoạt từ cả tên ngắn (temp, hum, lux) lẫn tên dài
        raw_temp = data.get("temp") if data.get("temp") is not None else data.get("temperature")
        raw_hum = data.get("hum") if data.get("hum") is not None else data.get("humidity")
        raw_lux = data.get("lux") if data.get("lux") is not None else data.get("light")

        temp = float(raw_temp) if raw_temp is not None else None
        hum = float(raw_hum) if raw_hum is not None else None
        lux = float(raw_lux) if raw_lux is not None else None

        if temp is None and hum is None and lux is None:
            return

        # 1. Lưu CSDL MySQL
        async with AsyncSessionLocal() as session:
            async with session.begin():
                if temp is not None:
                    session.add(DataSensor(sensor_id=1, value=temp))
                if hum is not None:
                    session.add(DataSensor(sensor_id=2, value=hum))
                if lux is not None:
                    session.add(DataSensor(sensor_id=3, value=lux))
        
        #print(f"✅ [DATABASE SAVED] Temp: {temp}°C | Hum: {hum}% | Lux: {lux}lx")

        # 2. Phát WebSocket Realtime xuống React
        from main import manager
        await manager.broadcast({
            "type": "SENSOR_UPDATE",
            "data": {
                "temperature": temp,
                "humidity": hum,
                "light": lux
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