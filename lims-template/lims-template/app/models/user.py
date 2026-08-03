"""
User model + Role enum
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, Boolean, DateTime, Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class Role(str, Enum):
    ADMIN = "ADMIN"
    QA_MANAGER = "QA_MANAGER"
    LAB_MANAGER = "LAB_MANAGER"
    TECHNICIAN = "TECHNICIAN"
    SAMPLER = "SAMPLER"
    CLIENT = "CLIENT"
    AUDITOR = "AUDITOR"


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    username: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(100))
    role: Mapped[Role] = mapped_column(SAEnum(Role, name="role_enum"), default=Role.TECHNICIAN)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    is_superuser: Mapped[bool] = mapped_column(Boolean, default=False)
    client_id: Mapped[Optional[str]] = mapped_column(String(36), nullable=True)  # for CLIENT role
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    created_samples = relationship("Sample", back_populates="creator", foreign_keys="Sample.created_by")
    assignments = relationship("Assignment", back_populates="assigned_to_user")