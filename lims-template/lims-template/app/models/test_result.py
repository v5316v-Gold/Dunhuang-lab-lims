"""
TestResult model - 检测结果
"""
from datetime import datetime
from enum import Enum
from typing import Optional

from sqlalchemy import String, Text, DateTime, Enum as SAEnum, ForeignKey, Numeric, Index
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ResultStatus(str, Enum):
    PRELIMINARY = "PRELIMINARY"  # 预填
    FINAL = "FINAL"              # 已定稿
    VERIFIED = "VERIFIED"        # 已审核
    LOCKED = "LOCKED"            # 已锁定（签发后）


class TestResult(Base):
    __tablename__ = "test_results"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    assignment_id: Mapped[str] = mapped_column(String(36), ForeignKey("assignments.id"), index=True)
    test_item_id: Mapped[str] = mapped_column(String(36), ForeignKey("test_items.id"))

    # 数值结果
    numeric_value: Mapped[Optional[float]] = mapped_column(Numeric(18, 6), nullable=True)
    text_value: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    unit: Mapped[str] = mapped_column(String(20))

    # 定性结果
    is_qualitative: Mapped[bool] = mapped_column(default=False)

    # 状态
    status: Mapped[ResultStatus] = mapped_column(
        SAEnum(ResultStatus, name="result_status_enum"), default=ResultStatus.PRELIMINARY
    )

    # 原始数据文件路径
    raw_data_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    attachments: Mapped[Optional[list]] = mapped_column(JSON, nullable=True)

    # 判定
    is_oos: Mapped[bool] = mapped_column(default=False)  # Out of Spec
    is_loq_below: Mapped[bool] = mapped_column(default=False)  # 低于检出限

    # 电子签名
    submitted_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_by: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    # 变更记录
    change_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relations
    assignment = relationship("Assignment", back_populates="results")
    test_item = relationship("TestItem")

    __table_args__ = (
        Index("ix_test_results_assignment", "assignment_id"),
    )