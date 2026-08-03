"""
Sample schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.sample import SampleStatus, SamplePriority


class SampleCreate(BaseModel):
    name: str
    category: str  # 环境/食品/药品/材料
    description: Optional[str] = None
    priority: SamplePriority = SamplePriority.ROUTINE
    due_date: Optional[datetime] = None
    client_id: str
    metadata: Optional[dict] = None

    @field_validator("category")
    @classmethod
    def validate_category(cls, v: str) -> str:
        allowed = {"环境检测", "食品检测", "药品检测", "材料检测", "其他"}
        if v not in allowed:
            raise ValueError(f"category必须是{allowed}之一")
        return v


class SampleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[SamplePriority] = None
    due_date: Optional[datetime] = None
    metadata: Optional[dict] = None


class SampleStatusTransition(BaseModel):
    status: SampleStatus
    reason: Optional[str] = None


class SampleAssign(BaseModel):
    technician_id: str


class SampleSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sample_number: str
    name: str
    category: str
    status: SampleStatus
    priority: SamplePriority
    description: Optional[str]
    client_id: str
    created_by: str
    assigned_to: Optional[str]
    received_at: datetime
    due_date: Optional[datetime]
    completed_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime


class SampleListQuery(BaseModel):
    status: Optional[SampleStatus] = None
    category: Optional[str] = None
    client_id: Optional[str] = None
    assigned_to: Optional[str] = None
    keyword: Optional[str] = None  # 搜索样品名称/编号
    page: int = 1
    page_size: int = 20


class SampleListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[SampleSchema]


class SampleBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sample_number: str
    name: str
    status: SampleStatus
    priority: SamplePriority
    due_date: Optional[datetime]