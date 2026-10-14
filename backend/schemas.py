from pydantic import BaseModel, Field
from typing import Optional

class LoginSchema(BaseModel):
    username: str = Field(
        ..., 
        description="Tên đăng nhập hệ thống", 
        example="vuhuy"
    )
    password: str = Field(
        ..., 
        description="Mật khẩu tài khoản", 
        example="12345"
    )

class DeviceControlSchema(BaseModel):
    device_id: int = Field(
        ..., 
        description="ID của thiết bị cần điều khiển trong CSDL (1: Đèn led 1, 2: Đèn led 2)", 
        example=1
    )
    action: str = Field(
        ..., 
        description="Trạng thái kích hoạt mong muốn ('ON' hoặc 'OFF')", 
        example="ON"
    )