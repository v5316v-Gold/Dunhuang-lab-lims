"""
User schemas
"""
from datetime import datetime
from pydantic import BaseModel, EmailStr, ConfigDict, field_validator

from app.models.user import Role


class UserBase(BaseModel):
    username: str
    email: EmailStr
    full_name: str
    role: Role = Role.TECHNICIAN
    client_id: str | None = None


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    @classmethod
    def password_length(cls, v: str) -> str:
        if len(v) < 8:
            raise ValueError("密码长度至少8位")
        return v


class UserUpdate(BaseModel):
    email: EmailStr | None = None
    full_name: str | None = None
    role: Role | None = None
    is_active: bool | None = None


class UserSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    email: str
    full_name: str
    role: Role
    is_active: bool
    client_id: str | None = None
    created_at: datetime


class UserBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    username: str
    full_name: str
    role: Role


# Auth schemas
class TokenPayload(BaseModel):
    sub: str
    exp: datetime
    type: str = "access"


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginRequest(BaseModel):
    username: str
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str