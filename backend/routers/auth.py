from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from passlib.context import CryptContext
from jose import jwt, JWTError
from datetime import datetime, timedelta

from database import get_db
from models import User
from schemas import LoginSchema
from config import settings

router = APIRouter()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Sử dụng HTTPBearer thay cho OAuth2PasswordBearer
security_bearer = HTTPBearer()

# Hàm dependency giải mã JWT Token
async def get_current_user(
    auth: HTTPAuthorizationCredentials = Depends(security_bearer), 
    db: AsyncSession = Depends(get_db)
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token không hợp lệ hoặc đã hết hạn",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    token = auth.credentials

    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()
    if user is None:
        raise credentials_exception
        
    return user

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
    summary="Lấy thông tin Hồ sơ Sinh viên (Profile)"
)
async def get_me(current_user: User = Depends(get_current_user)):
    return {
        "fullName": current_user.fullName,
        "student_id": current_user.student_id,
        "class": current_user.class_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "avatar": current_user.avatar
    }