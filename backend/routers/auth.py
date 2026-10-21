from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
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

# Cấu hình Scheme lấy Bearer Token từ Header cho Swagger UI & API
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# Hàm dependency giải mã JWT Token để lấy thông tin User đang đăng nhập
async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token không hợp lệ hoặc đã hết hạn",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Giải mã chuỗi JWT Token
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            print("❌ Lỗi JWT: Không tìm thấy field 'sub' trong Payload")
            raise credentials_exception
    except JWTError as e:
        print(f"❌ Lỗi giải mã JWT: {e}")  # Sẽ in ra lý do (VD: Signature has expired)
        raise credentials_exception

    # Truy vấn CSDL
    result = await db.execute(select(User).filter(User.username == username))
    user = result.scalars().first()
    if user is None:
        print(f"❌ Lỗi CSDL: Không tìm thấy username '{username}' trong bảng Users")
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
async def get_me(current_user: User = Depends(get_current_user)):
    """
    **Lấy Thông tin Cá nhân**:
    - Tự động lấy hồ sơ từ JWT Token của tài khoản đang đăng nhập.
    - Trả về Họ tên, MSNV, Lớp, Email, SĐT và Đường dẫn Ảnh đại diện Static.
    """
    return {
        "fullName": current_user.fullName,
        "student_id": current_user.student_id,
        "class": current_user.class_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "avatar": current_user.avatar
    }