"""
TestResult endpoints
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, require_roles
from app.core.exceptions import ResultLockedError
from app.models.user import User, Role
from app.models.assignment import Assignment, AssignmentStatus
from app.models.test_result import TestResult, ResultStatus
from app.models.test_item import TestItem
from app.schemas.test_result import (
    TestResultSubmit, TestResultSchema,
    TestResultListResponse,
)

router = APIRouter(prefix="/results", tags=["检测结果"])


@router.post("", response_model=TestResultSchema, status_code=status.HTTP_201_CREATED)
async def submit_result(
    data: TestResultSubmit,
    assignment_id: str,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER, Role.TECHNICIAN)),
    db=Depends(get_db),
):
    # 验证任务存在
    asgn_result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = asgn_result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="检测任务不存在")

    # 获取检测项目
    item_result = await db.execute(select(TestItem).where(TestItem.id == assignment.test_item_id))
    item = item_result.scalar_one_or_none()

    result = TestResult(
        id=uuid.uuid4().hex,
        assignment_id=assignment_id,
        test_item_id=assignment.test_item_id,
        numeric_value=data.numeric_value,
        text_value=data.text_value,
        unit=data.unit or (item.unit if item else ""),
        is_qualitative=data.is_qualitative,
        is_oos=data.is_oos,
        is_loq_below=data.is_loq_below,
        raw_data_path=data.raw_data_path,
        status=ResultStatus.PRELIMINARY,
        submitted_by=user.id,
    )

    from datetime import datetime
    result.submitted_at = datetime.utcnow()

    db.add(result)
    await db.commit()
    await db.refresh(result)
    return result


@router.put("/{result_id}", response_model=TestResultSchema)
async def update_result(
    result_id: str,
    data: TestResultSubmit,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER, Role.TECHNICIAN)),
    db=Depends(get_db),
):
    result = await db.execute(select(TestResult).where(TestResult.id == result_id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="结果不存在")

    if res.status == ResultStatus.LOCKED:
        raise HTTPException(status_code=422, detail="结果已锁定，禁止修改")

    if not data.change_reason:
        raise HTTPException(status_code=422, detail="修改结果必须填写变更原因")

    res.numeric_value = data.numeric_value
    res.text_value = data.text_value
    res.unit = data.unit
    res.is_oos = data.is_oos
    res.is_loq_below = data.is_loq_below
    res.change_reason = data.change_reason
    res.status = ResultStatus.PRELIMINARY  # 修改后重新变为预填状态

    await db.commit()
    await db.refresh(res)
    return res


@router.post("/{result_id}/verify", response_model=TestResultSchema)
async def verify_result(
    result_id: str,
    user: User = Depends(require_roles(Role.ADMIN, Role.QA_MANAGER)),
    db=Depends(get_db),
):
    result = await db.execute(select(TestResult).where(TestResult.id == result_id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="结果不存在")

    if res.status not in [ResultStatus.FINAL, ResultStatus.PRELIMINARY]:
        raise HTTPException(status_code=422, detail=f"当前状态{res.status.value}无法审核")

    res.status = ResultStatus.VERIFIED
    res.verified_by = user.id
    from datetime import datetime
    res.verified_at = datetime.utcnow()

    await db.commit()
    await db.refresh(res)
    return res


@router.post("/{result_id}/lock", response_model=TestResultSchema)
async def lock_result(
    result_id: str,
    user: User = Depends(require_roles(Role.ADMIN, Role.QA_MANAGER)),
    db=Depends(get_db),
):
    """锁定结果（报告签发前）"""
    result = await db.execute(select(TestResult).where(TestResult.id == result_id))
    res = result.scalar_one_or_none()
    if not res:
        raise HTTPException(status_code=404, detail="结果不存在")

    res.status = ResultStatus.LOCKED
    await db.commit()
    await db.refresh(res)
    return res


@router.get("", response_model=TestResultListResponse)
async def list_results(
    assignment_id: str | None = Query(None),
    sample_id: str | None = Query(None),
    status: ResultStatus | None = Query(None),
    is_oos: bool | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    filters = []
    if assignment_id:
        filters.append(TestResult.assignment_id == assignment_id)
    if status:
        filters.append(TestResult.status == status)
    if is_oos is not None:
        filters.append(TestResult.is_oos == is_oos)

    where = and_(*filters) if filters else True

    total_q = select(func.count(TestResult.id)).where(where)
    total = (await db.execute(total_q)).scalar_one()

    items_q = (
        select(TestResult)
        .where(where)
        .options(selectinload(TestResult.assignment))
        .order_by(TestResult.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(items_q)).scalars().all()

    return TestResultListResponse(total=total, page=page, page_size=page_size, items=items)