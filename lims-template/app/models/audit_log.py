"""
AuditLog model - 审计日志
"""
from datetime import datetime
from sqlalchemy import String, Text, DateTime, Index
from sqlalchemy import JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)

    # 谁
    operator_id: Mapped[str] = mapped_column(String(36), index=True)
    operator_name: Mapped[str] = mapped_column(String(100))
    operator_ip: Mapped[str] = mapped_column(String(45))

    # 什么
    action: Mapped[str] = mapped_column(String(50), index=True)  # CREATE/UPDATE/DELETE/LOGIN/SIGN
    entity_type: Mapped[str] = mapped_column(String(50))  # Sample/Assignment/TestResult/User
    entity_id: Mapped[str] = mapped_column(String(36), index=True)
    entity_repr: Mapped[str] = mapped_column(String(255))  # 便于阅读的描述

    # 变更内容
    changes: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # 示例: {"status": {"old": "PENDING", "new": "ASSIGNED"}}

    # 原因（仅变更时）
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # 防篡改
    digest: Mapped[str] = mapped_column(String(64))  # SHA256 chain digest
    prev_digest: Mapped[str | None] = mapped_column(String(64), nullable=True)

    # 时间戳
    occurred_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)

    # Relations
    sample = relationship("Sample", back_populates="audit_logs")

    __table_args__ = (
        Index("ix_audit_entity", "entity_type", "entity_id"),
        Index("ix_audit_operator_time", "operator_id", "occurred_at"),
    )