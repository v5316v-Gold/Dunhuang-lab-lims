"""
API dependencies - get_db, get_current_user, rate limit
"""
from typing import Annotated

from fastapi import Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.core.security import decode_token
from app.models.user import User, Role
from app.models.sample import Sample

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


# -----------------------------------------------
# DB Session
# -----------------------------------------------
async def get_db() -> AsyncSession:
    async with AsyncSessionLocal() as session:
        yield session


# -----------------------------------------------
# Current User
# -----------------------------------------------
async def get_current_user(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User:
    if not token:
        raise HTTPException(status_code=401, detail="未登录")

    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Token无效或已过期")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token无效")

    from app.models.user import User as UserModel
    from sqlalchemy import select

    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()

    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="用户不存在或已禁用")

    return user


# -----------------------------------------------
# Optional current user (for public endpoints)
# -----------------------------------------------
async def get_current_user_optional(
    token: Annotated[str | None, Depends(oauth2_scheme)],
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if not token:
        return None

    payload = decode_token(token)
    if not payload:
        return None

    user_id = payload.get("sub")
    if not user_id:
        return None

    from app.models.user import User as UserModel
    from sqlalchemy import select

    result = await db.execute(select(UserModel).where(UserModel.id == user_id))
    user = result.scalar_one_or_none()
    return user if user and user.is_active else None


# -----------------------------------------------
# Role checks
# -----------------------------------------------
def require_roles(*roles: Role):
    async def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="权限不足")
        return user
    return checker


# Built-in role check shortcuts
require_admin = require_roles(Role.ADMIN)
require_qa_or_admin = require_roles(Role.ADMIN, Role.QA_MANAGER)
require_technician_or_above = require_roles(Role.ADMIN, Role.LAB_MANAGER, Role.TECHNICIAN)


# -----------------------------------------------
# Pagination
# -----------------------------------------------
def paginated_params(
    page: int = 1,
    page_size: int = 20,
) -> tuple[int, int]:
    if page < 1:
        page = 1
    if page_size < 1 or page_size > 200:
        page_size = 20
    offset = (page - 1) * page_size
    return offset, page_size