"""
Auth endpoints - login / register / refresh
"""
from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.api.deps import get_db, get_current_user
from app.core.security import (
    verify_password, hash_password, create_access_token,
    create_refresh_token, create_access_token_from_refresh,
)
from app.schemas.user import (
    TokenResponse, UserCreate, UserSchema, RefreshRequest,
)
from app.models.user import User, Role

router = APIRouter(prefix="/auth", tags=["认证"])


@router.post("/login", response_model=TokenResponse)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db=Depends(get_db),
):
    from sqlalchemy import select
    result = await db.execute(
        select(User).where(User.username == form_data.username)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="用户名或密码错误")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="用户已禁用")

    access_token = create_access_token(data={"sub": user.id})
    refresh_token = create_refresh_token(user.id)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/register", response_model=UserSchema, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    db=Depends(get_db),
):
    from sqlalchemy import select
    # Check duplicate username
    r1 = await db.execute(select(User).where(User.username == user_in.username))
    if r1.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="用户名已存在")
    # Check duplicate email
    r2 = await db.execute(select(User).where(User.email == user_in.email))
    if r2.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="邮箱已被注册")

    user = User(
        id=__import__("uuid").uuid4().hex,
        username=user_in.username,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role,
        client_id=user_in.client_id,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(body: RefreshRequest):
    new_access = create_access_token_from_refresh(body.refresh_token)
    if not new_access:
        raise HTTPException(status_code=401, detail="Refresh token无效或已过期")
    return TokenResponse(
        access_token=new_access,
        refresh_token=body.refresh_token,  # 返回原refresh token
    )


@router.get("/me", response_model=UserSchema)
async def get_me(user: User = Depends(get_current_user)):
    return user