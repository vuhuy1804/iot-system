from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DB_HOST: str
    DB_PORT: int
    DB_USER: str
    DB_PASSWORD: str
    DB_NAME: str

    SECRET_KEY: str
    ALGORITHM: str
    ACCESS_TOKEN_EXPIRE_MINUTES: int

    MQTT_BROKER: str
    MQTT_PORT: int
    MQTT_USER: str
    MQTT_PASSWORD: str

    class Config:
        env_file = ".env"

settings = Settings()