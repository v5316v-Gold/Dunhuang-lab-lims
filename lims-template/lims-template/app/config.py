"""
Configuration - pydantic-settings with .env support
"""
from pydantic_settings import BaseSettings, SettingsConfigDict
from functools import lru_cache


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # App
    APP_NAME: str = "LIMS Template"
    DEBUG: bool = False
    ALLOWED_ORIGINS: list[str] = ["*"]

    # Database
    DATABASE_URL: str = "postgresql+asyncpg://lims:lims@localhost:5432/lims_db"

    # JWT
    SECRET_KEY: str = "CHANGE_ME_IN_PRODUCTION_USE_STRONG_RANDOM_KEY"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480

    # Redis (idempotency + cache)
    REDIS_URL: str = "redis://localhost:6379/0"

    # Security
    PASSWORD_MIN_LENGTH: int = 8

    # Audit
    AUDIT_ENABLED: bool = True

    # File storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE_MB: int = 50


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()