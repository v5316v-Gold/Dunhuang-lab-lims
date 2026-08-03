"""
Sample model
"""
from datetime import datetime
from enum import Enum
from typing import Optional, List

from sqlalchemy import String, Text, DateTime, Enum as SAEnum, ForeignKey, Index
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class SampleStatus(str, Enum):
    RECEIVED = "RECEIVED"
    PENDING = "PENDING"
    ASSIGNED = "ASSIGNED"
    IN_PROGRESS = "IN_PROGRESS"
    REVIEWING = "REVIEWING"
    REPORTED = "REPORTED"
    ARCHIVED = "ARCHIVED"


class SamplePriority(str, Enum):
    ROUTINE = "ROUTINE"
    URGENT = "URGENT"
    STAT = "STAT"


class Sample(Base):
    __tablename__ = "samples"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    sample_number: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    category: Mapped[str] = mapped_column(String(100))  # 环境/食品/药品/材料
    status: Mapped[SampleStatus] = mapped_column(
        SAEnum(SampleStatus, name="sample_status_enum"), default=SampleStatus.RECEIVED
    )
    priority: Mapped[SamplePriority] = mapped_column(
        SAEnum(SamplePriority, name="sample_priority_enum"), default=SamplePriority.ROUTINE
    )
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)  # 扩展字段

    # Foreign keys
    client_id: Mapped[str] = mapped_column(String(36), index=True)
    created_by: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    assigned_to: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)

    # Dates
    received_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    archived_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    creator = relationship("User", back_populates="created_samples", foreign_keys=[created_by])
    assignee = relationship("User", foreign_keys=[assigned_to])
    assignments = relationship("Assignment", back_populates="sample", cascade="all, delete-orphan")
    audit_logs = relationship("AuditLog", back_populates="sample", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_samples_status_client", "status", "client_id"),
        Index("ix_samples_due_date", "due_date"),
    )