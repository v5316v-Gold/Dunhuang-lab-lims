"""
Sample endpoints
"""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, func, and_

from app.api.deps import get_db, get_current_user, require_roles
from app.core.exceptions import NotFoundError, InvalidTransitionError
from app.models.user import User, Role
from app.models.sample import Sample, SampleStatus, SamplePriority
from app.schemas.sample import (
    SampleCreate, SampleUpdate, SampleSchema,
    SampleListResponse, SampleAssign, SampleStatusTransition,
)

router = APIRouter(prefix="/samples", tags=["样品管理"])


def _generate_sample_number(category: str) -> str:
    prefix_map = {"环境检测": "ENV", "食品检测": "FD", "药品检测": "MED", "材料检测": "MAT", "其他": "OTH"}
    prefix = prefix_map.get(category, "UNK")
    serial = uuid.uuid4().hex[:8].upper()
    return f"{prefix}-2026{serial}"


@router.post("", response_model=SampleSchema, status_code=status.HTTP_201_CREATED)
async def create_sample(
    data: SampleCreate,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER, Role.SAMPLER)),
    db=Depends(get_db),
):
    sample = Sample(
        id=uuid.uuid4().hex,
        sample_number=_generate_sample_number(data.category),
        name=data.name,
        category=data.category,
        description=data.description,
        priority=data.priority,
        due_date=data.due_date,
        client_id=data.client_id,
        created_by=user.id,
        status=SampleStatus.RECEIVED,
        metadata=data.metadata,
    )
    db.add(sample)
    await db.commit()
    await db.refresh(sample)
    return sample


@router.get("", response_model=SampleListResponse)
async def list_samples(
    status: SampleStatus | None = Query(None),
    category: str | None = Query(None),
    client_id: str | None = Query(None),
    assigned_to: str | None = Query(None),
    keyword: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=200),
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    # CLIENT role只能看自己的样品
    if user.role == Role.CLIENT:
        client_id = user.client_id

    filters = []
    if status:
        filters.append(Sample.status == status)
    if category:
        filters.append(Sample.category == category)
    if client_id:
        filters.append(Sample.client_id == client_id)
    if assigned_to:
        filters.append(Sample.assigned_to == assigned_to)
    if keyword:
        filters.append(Sample.name.ilike(f"%{keyword}%"))

    where = and_(*filters) if filters else True

    # Count
    count_q = select(func.count(Sample.id)).where(where)
    total = (await db.execute(count_q)).scalar_one()

    # List
    q = (
        select(Sample)
        .where(where)
        .order_by(Sample.received_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    items = (await db.execute(q)).scalars().all()

    return SampleListResponse(total=total, page=page, page_size=page_size, items=items)


@router.get("/{sample_id}", response_model=SampleSchema)
async def get_sample(
    sample_id: str,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=404, detail="样品不存在")

    # 权限：CLIENT只能看自己
    if user.role == Role.CLIENT and sample.client_id != user.client_id:
        raise HTTPException(status_code=403, detail="无权访问此样品")

    return sample


@router.patch("/{sample_id}", response_model=SampleSchema)
async def update_sample(
    sample_id: str,
    data: SampleUpdate,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER)),
    db=Depends(get_db),
):
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=404, detail="样品不存在")

    update_data = data.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(sample, k, v)

    await db.commit()
    await db.refresh(sample)
    return sample


@router.post("/{sample_id}/assign", response_model=SampleSchema)
async def assign_sample(
    sample_id: str,
    data: SampleAssign,
    user: User = Depends(require_roles(Role.ADMIN, Role.LAB_MANAGER)),
    db=Depends(get_db),
):
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=404, detail="样品不存在")

    if sample.status != SampleStatus.PENDING:
        raise HTTPException(status_code=422, detail=f"样品状态为{sample.status.value}，只能对待分配状态的样品进行分配")

    sample.status = SampleStatus.ASSIGNED
    sample.assigned_to = data.technician_id

    await db.commit()
    await db.refresh(sample)
    return sample


@router.post("/{sample_id}/status", response_model=SampleSchema)
async def transition_status(
    sample_id: str,
    data: SampleStatusTransition,
    user: User = Depends(get_current_user),
    db=Depends(get_db),
):
    result = await db.execute(select(Sample).where(Sample.id == sample_id))
    sample = result.scalar_one_or_none()
    if not sample:
        raise HTTPException(status_code=404, detail="样品不存在")

    # 状态流转规则
    allowed_transitions = {
        SampleStatus.RECEIVED: [SampleStatus.PENDING],
        SampleStatus.PENDING: [SampleStatus.ASSIGNED],
        SampleStatus.ASSIGNED: [SampleStatus.IN_PROGRESS],
        SampleStatus.IN_PROGRESS: [SampleStatus.REVIEWING, SampleStatus.ASSIGNED],
        SampleStatus.REVIEWING: [SampleStatus.REPORTED, SampleStatus.IN_PROGRESS],
        SampleStatus.REPORTED: [SampleStatus.ARCHIVED],
    }

    if data.status not in allowed_transitions.get(sample.status, []):
        raise HTTPException(
            status_code=422,
            detail=f"不允许从{sample.status.value}变更为{data.status.value}",
        )

    sample.status = data.status
    if data.status == SampleStatus.REPORTED:
        from datetime import datetime
        sample.completed_at = datetime.utcnow()

    await db.commit()
    await db.refresh(sample)
    return sample