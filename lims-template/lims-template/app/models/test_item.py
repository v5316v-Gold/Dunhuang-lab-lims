"""
TestItem model - 检测项目/方法目录
"""
from sqlalchemy import String, Text, Boolean, Numeric
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TestItem(Base):
    __tablename__ = "test_items"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    code: Mapped[str] = mapped_column(String(50), unique=True, index=True)  # 方法标准号
    name: Mapped[str] = mapped_column(String(255))  # 方法名称
    category: Mapped[str] = mapped_column(String(100))  # 所属类别
    unit: Mapped[str] = mapped_column(String(20))  # 结果单位
    default_limit: Mapped[str] = mapped_column(String(100), nullable=True)  # 默认限值
    
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    
    # LOQ/LOD
    loq: Mapped[str | None] = mapped_column(String(50), nullable=True)
    lod: Mapped[str | None] = mapped_column(String(50), nullable=True)