from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from passlib.context import CryptContext
from jose import jwt
from datetime import datetime, timedelta

from database import get_db
from models import User
from schemas import LoginSchema
from config import settings

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

@router.post(
    "/login", 
    summary="Đăng nhập tài khoản hệ thống",
    responses={
        200: {
            "description": "Đăng nhập thành công, trả về JWT Token và thông tin cơ bản.",
            "content": {
                "application/json": {
                    "example": {
                        "access_token": "eyJhbGciOiJIUzI1Ni...",
                        "token_type": "bearer",
                        "user_info": {
                            "username": "vuhuy",
                            "fullName": "Vũ Quang Huy",
                            "student_id": "B23DCCN412",
                            "class": "D23CNPM03",
                            "email": "huyvq.b23cn412@stu.ptit.edu.vn"
                        }
                    }
                }
            }
        },
        400: {
            "description": "Sai tài khoản hoặc mật khẩu.",
            "content": {
                "application/json": {
                    "example": {"detail": "Tên đăng nhập hoặc mật khẩu không chính xác"}
                }
            }
        }
    }
)
async def login(data: LoginSchema, db: AsyncSession = Depends(get_db)):
    """
    **Xác thực Tài khoản Người dùng**:
    - So sánh Username và Hash Password mã hóa bằng `bcrypt`.
    - Tạo chuỗi Bearer JWT Token có thời hạn cấu hình.
    """
    result = await db.execute(select(User).filter(User.username == data.username))
    user = result.scalars().first()
    
    if not user or not pwd_context.verify(data.password, user.password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tên đăng nhập hoặc mật khẩu không chính xác"
        )

    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    token = jwt.encode({"sub": user.username, "exp": expire}, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

    return {
        "access_token": token,
        "token_type": "bearer",
        "user_info": {
            "username": user.username,
            "fullName": user.fullName,
            "student_id": user.student_id,
            "class": user.class_name,
            "email": user.email
        }
    }

@router.get(
    "/me", 
    summary="Lấy thông tin Hồ sơ Sinh viên (Profile)",
    responses={
        200: {
            "description": "Chi tiết Hồ sơ sinh viên thực hiện đề tài",
            "content": {
                "application/json": {
                    "example": {
                        "fullName": "Vũ Quang Huy",
                        "student_id": "B23DCCN412",
                        "class": "D23CNPM03",
                        "email": "huyvq.b23cn412@stu.ptit.edu.vn",
                        "phone": "0826180405",
                        "avatar": "/static/avatars/vuhuy.jpg"
                    }
                }
            }
        },
        404: {
            "description": "Không tìm thấy thông tin người dùng trong CSDL.",
            "content": {
                "application/json": {
                    "example": {"detail": "Không tìm thấy người dùng"}
                }
            }
        }
    }
)
async def get_me(db: AsyncSession = Depends(get_db)):
    """
    **Lấy Thông tin Cá nhân**:
    - Truy vấn thông tin tài khoản sinh viên quản trị (`vuhuy`).
    - Trả về Họ tên, MSNV, Lớp, Email, SĐT và Đường dẫn Ảnh đại diện Static.
    """
    result = await db.execute(select(User).filter(User.username == "vuhuy"))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="Không tìm thấy người dùng")
    return {
        "fullName": user.fullName,
        "student_id": user.student_id,
        "class": user.class_name,
        "email": user.email,
        "phone": user.phone,
        "avatar": user.avatar
    }