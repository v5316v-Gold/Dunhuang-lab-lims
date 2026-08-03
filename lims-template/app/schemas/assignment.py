"""
Assignment schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict

from app.models.assignment import AssignmentStatus


class AssignmentCreate(BaseModel):
    sample_id: str
    test_item_id: str
    assigned_to: str
    method_code: str
    method_name: str
    due_date: Optional[datetime] = None
    notes: Optional[str] = None


class AssignmentUpdate(BaseModel):
    notes: Optional[str] = None
    due_date: Optional[datetime] = None


class AssignmentStart(BaseModel):  # 实验员开始操作
    pass


class AssignmentComplete(BaseModel):
    notes: Optional[str] = None


class AssignmentSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sample_id: str
    assigned_to: str
    test_item_id: str
    status: AssignmentStatus
    method_code: str
    method_name: str
    assigned_at: datetime
    started_at: Optional[datetime]
    completed_at: Optional[datetime]
    due_date: Optional[datetime]
    notes: Optional[str]
    created_at: datetime
    updated_at: datetime


class AssignmentWithSample(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    sample_id: str
    sample_number: str
    sample_name: str
    test_item_id: str
    test_item_name: str
    assigned_to: str
    assigned_to_name: str
    status: AssignmentStatus
    method_code: str
    method_name: str
    assigned_at: datetime
    completed_at: Optional[datetime]
    due_date: Optional[datetime]


class AssignmentListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[AssignmentSchema]