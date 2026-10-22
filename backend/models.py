from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.sql import func
from database import Base

class User(Base):
    __tablename__ = "User"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False)
    password = Column(String(255), nullable=False)
    fullName = Column(String(100), nullable=False)
    student_id = Column(String(20), nullable=False)
    class_name = Column("class", String(50), nullable=False)
    email = Column(String(100), nullable=False)
    phone = Column(String(20), nullable=True)
    avatar = Column(String(255), nullable=True)

class Sensor(Base):
    __tablename__ = "Sensor"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False) # Nhiệt độ (1), Độ ẩm (2), Ánh sáng (3), Tốc độ gió (4)
    unit = Column(String(20), nullable=False)

class DataSensor(Base):
    __tablename__ = "DataSensor"
    id = Column(Integer, primary_key=True, index=True)
    value = Column(Float, nullable=False)
    recorded_at = Column(DateTime, server_default=func.now())
    sensor_id = Column(Integer, ForeignKey("Sensor.id"))

class Device(Base):
    __tablename__ = "Device"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), nullable=False)
    status = Column(String(10), default="OFF")

class ActionHistory(Base):
    __tablename__ = "ActionHistory"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("User.id"))
    device_id = Column(Integer, ForeignKey("Device.id"))
    action = Column(String(50), nullable=False)
    status = Column(String(20), nullable=False)
    recorded_at = Column(DateTime, server_default=func.now())


class AlertHistory(Base):
    __tablename__ = "AlertHistory"
    id = Column(Integer, primary_key=True, index=True)
    sensor_type = Column(String(50), default="Tốc độ gió")
    value = Column(Float, nullable=False)
    recorded_at = Column(DateTime, server_default=func.now())