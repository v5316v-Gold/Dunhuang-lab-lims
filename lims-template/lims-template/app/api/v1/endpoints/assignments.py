"""
Assignment endpoints
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload

from app.api.deps import get_db, get_current_user, require_roles
from app.models.user import User, Role
from app.models.sample import Sample, SampleStatus
from app.models.assignment import Assignment, AssignmentStatus
from app.models.test_item import TestItem
from app.schemas.assignment import (
    AssignmentCreate, AssignmentSchema,
    AssignmentListResponse,
)

router = APIRouter(prefix="/assignments", tags=["检测任务"])


@router.post("", response_model=AssignmentSchema, status_code=status.HTTP_201_CREATED)
async def create_assignment(
    data: AssignmentCreate,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER)),
    db=Depends(get_db),
):
    # 验证样品存在
    sample_result = await db.execute(select(Sample).where(Sample.id == data.sample_id))
    sample = sample_result.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=404, detail="样品不存在")

    # 验证检测项目存在
    item_result = await db.execute(select(TestItem).where(TestItem.id == data.test_item_id))
    item = item_result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="检测项目不存在")

    assignment = Assignment(
        id=uuid.uuid4().hex,
        sample_id=data.sample_id,
        test_item_id=data.test_item_id,
        assigned_to=data.assigned_to,
        method_code=data.method_code,
        method_name=data.method_name,
        due_date=data.due_date,
        notes=data.notes,
        status=AssignmentStatus.PENDING,
    )
    db.add(assignment)

    # 更新样品状态
    if sample.status == SampleStatus.PENDING:
        sample.status = SampleStatus.ASSIGNED

    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.get("", response_model=AssignmentListResponse)
async def list_assignments(
    status: AssignmentStatus | None = Query(None),
    assigned_to: str | None = Query(None),
    sample_id: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    filters = []
    if status:
        filters.append(Assignment.status == status)
    if assigned_to:
        filters.append(Assignment.assigned_to == assigned_to)
    if sample_id:
        filters.append(Assignment.sample_id == sample_id)

    where = and_(*filters) if filters else True

    total_q = select(func.count(Assignment.id)).where(where)
    total = (await db.execute(total_q)).scalar_one()

    items_q = (
        select(Assignment)
        .where(where)
        .options(selectinload(Assignment.sample), selectinload(Assignment.assigned_to_user))
        .order_by(Assignment.assigned_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(items_q)).scalars().all()

    return AssignmentListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/{assignment_id}", response_model=AssignmentSchema)
async def get_assignment(
    assignment_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(
        select(Assignment)
        .options(selectinload(Assignment.sample), selectinload(Assignment.assigned_to_user))
        .where(Assignment.id == assignment_id)
    )
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="任务不存在")
    return assignment


@router.post("/{assignment_id}/start", response_model=AssignmentSchema)
async def start_assignment(
    assignment_id: str,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER, Role.TECHNICIAN)),
    db=Depends(get_db),
):
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="任务不存在")
    if assignment.status != AssignmentStatus.PENDING:
        raise HTTPException(status_code=422, detail="任务已非待执行状态")
    assignment.status = AssignmentStatus.IN_PROGRESS
    from datetime import datetime
    assignment.started_at = datetime.utcnow()
    await db.commit()
    await db.refresh(assignment)
    return assignment


@router.post("/{assignment_id}/complete", response_model=AssignmentSchema)
async def complete_assignment(
    assignment_id: str,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER, Role.TECHNICIAN)),
    db=Depends(get_db),
):
    result = await db.execute(select(Assignment).where(Assignment.id == assignment_id))
    assignment = result.scalar_one_or_none()
    if not assignment:
        raise HTTPException(status_code=404, detail="任务不存在")
    if assignment.status != AssignmentStatus.IN_PROGRESS:
        raise HTTPException(status_code=422, detail="任务未在执行中")
    assignment.status = AssignmentStatus.COMPLETED
    from datetime import datetime
    assignment.completed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(assignment)
    return assignment