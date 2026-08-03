"""
Assignment model - 检测任务
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, Text, DateTime, Enum as SAEnum, ForeignKey, Numeric, Index
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AssignmentStatus(str, Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"


class Assignment(Base):
    __tablename__ = "assignments"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    
    # 关联
    sample_id: Mapped[str] = mapped_column(String(36), ForeignKey("samples.id"), index=True)
    assigned_to: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"))
    test_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_items.id"))
    
    # 状态
    status: Mapped[AssignmentStatus] = mapped_column(
        SAEnum(AssignmentStatus, name="assignment_status_enum"), default=AssignmentStatus.PENDING
    )
    
    # 任务信息
    method_code: Mapped[str] = mapped_column(String(50))  # 检测方法编号
    method_name: Mapped[str] = mapped_column(String(255))
    
    # 时间
    assigned_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    started_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    due_date: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    
    # 备注
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    result_metadata: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    sample = relationship("Sample", back_populates="assignments")
    assigned_to_user = relationship("User", back_populates="assignments")
    test_item = relationship("TestItem")
    results = relationship("TestResult", back_populates="assignment", cascade="all, delete-orphan")

    __table_args__ = (
        Index("ix_assignments_sample_status", "sample_id", "status"),
    )