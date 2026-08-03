"""
TestResult schemas
"""
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict, field_validator

from app.models.test_result import ResultStatus


class TestResultSubmit(BaseModel):
    numeric_value: Optional[float] = None
    text_value: Optional[str] = None
    unit: str
    is_qualitative: bool = False
    is_oos: bool = False
    is_loq_below: bool = False
    raw_data_path: Optional[str] = None
    change_reason: Optional[str] = None  # 变更时必须填写原因


class TestResultUpdate(BaseModel):
    numeric_value: Optional[float] = None
    text_value: Optional[str] = None
    change_reason: str  # 修改结果必须填写原因


class TestResultVerify(BaseModel):  # QA审核
    pass


class TestResultSchema(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    assignment_id: str
    test_item_id: str
    numeric_value: Optional[float]
    text_value: Optional[str]
    unit: str
    is_qualitative: bool
    status: ResultStatus
    raw_data_path: Optional[str]
    is_oos: bool
    is_loq_below: bool
    submitted_by: Optional[str]
    submitted_at: Optional[datetime]
    verified_by: Optional[str]
    verified_at: Optional[datetime]
    change_reason: Optional[str]
    created_at: datetime
    updated_at: datetime


class TestResultListResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[TestResultSchema]


class TestResultListQuery(BaseModel):
    assignment_id: Optional[str] = None
    sample_id: Optional[str] = None
    status: Optional[ResultStatus] = None
    is_oos: Optional[bool] = None
    page: int = 1
    page_size: int = 20