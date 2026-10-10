import asyncio
from passlib.context import CryptContext
from sqlalchemy.future import select
from database import AsyncSessionLocal
from models import User, Sensor, Device

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def seed_data():
    async with AsyncSessionLocal() as session:
        # 1. Chèn tài khoản Sinh viên
        result = await session.execute(select(User).filter(User.username == "vuhuy"))
        user = result.scalars().first()
        if not user:
            hashed_password = pwd_context.hash("12345")
            new_user = User(
                username="vuhuy",
                password=hashed_password,
                fullName="Vũ Quang Huy",
                student_id="B23DCCN412",
                class_name="D23CNPM03",
                email="huyvq.b23cn412@stu.ptit.edu.vn",
                phone="0826180405",
                github="github.com/vuhuy1804"
            )
            session.add(new_user)
            print("✅ Đã chèn tài khoản Sinh viên: Vũ Quang Huy - B23DCCN412")

        # 2. Chèn danh mục Cảm biến
        sensors = [
            {"id": 1, "name": "Nhiệt độ", "unit": "°C"},
            {"id": 2, "name": "Độ ẩm", "unit": "%"},
            {"id": 3, "name": "Ánh sáng", "unit": "lux"}
        ]
        for s in sensors:
            res = await session.execute(select(Sensor).filter(Sensor.id == s["id"]))
            if not res.scalars().first():
                session.add(Sensor(**s))
        print("✅ Đã chèn danh mục 3 Cảm biến (Nhiệt độ, Độ ẩm, Ánh sáng)")

        # 3. Chèn danh mục Thiết bị (Đèn LED)
        devices = [
            {"id": 1, "name": "Đèn led 1", "status": "OFF"},
            {"id": 2, "name": "Đèn led 2", "status": "OFF"}
        ]
        for d in devices:
            res = await session.execute(select(Device).filter(Device.id == d["id"]))
            if not res.scalars().first():
                session.add(Device(**d))
        print("✅ Đã chèn danh mục 2 Thiết bị (Đèn led 1, Đèn led 2)")

        await session.commit()
        print("🎉 TẤT CẢ DỮ LIỆU BAN ĐẦU ĐÃ ĐƯỢC CHÈN THÀNH CÔNG!")

if __name__ == "__main__":
    asyncio.run(seed_data())