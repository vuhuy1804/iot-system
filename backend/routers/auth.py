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

@router.post("/login")
async def login(data: LoginSchema, db: AsyncSession = Depends(get_db)):
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

@router.get("/me")
async def get_me(db: AsyncSession = Depends(get_db)):
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