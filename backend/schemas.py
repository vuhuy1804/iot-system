from pydantic import BaseModel
from typing import Optional

class LoginSchema(BaseModel):
    username: str
    password: str

class DeviceControlSchema(BaseModel):
    device_id: int
    action: str  # "ON" hoặc "OFF"