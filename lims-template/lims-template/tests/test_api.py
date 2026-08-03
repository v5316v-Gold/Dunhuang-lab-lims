"""
pytest configuration
"""
import pytest
import pytest_asyncio
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker

from app.main import app
from app.db.base import Base
from app.db.session import AsyncSessionLocal


# Use SQLite in-memory for tests
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestSessionLocal = async_sessionmaker(test_engine, class_=AsyncSession, expire_on_commit=False)


@pytest_asyncio.fixture
async def db_session():
    """Create a fresh database for each test."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with TestSessionLocal() as session:
        yield session

    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def client(db_session: AsyncSession):
    """HTTP test client using the app."""
    from app.api.deps import get_db

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


@pytest.mark.asyncio
async def test_health(client: AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_register_and_login(client: AsyncClient):
    # Register
    resp = await client.post("/api/v1/auth/register", json={
        "username": "testuser",
        "email": "test@example.com",
        "password": "testpass123",
        "full_name": "测试用户",
        "role": "TECHNICIAN",
    })
    assert resp.status_code == 201
    user_data = resp.json()
    assert user_data["username"] == "testuser"

    # Login
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "testuser", "password": "testpass123"},
    )
    assert resp.status_code == 200
    token_data = resp.json()
    assert "access_token" in token_data
    assert "refresh_token" in token_data

    # Get me
    resp = await client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {token_data['access_token']}"},
    )
    assert resp.status_code == 200
    assert resp.json()["username"] == "testuser"


@pytest.mark.asyncio
async def test_create_sample(client: AsyncClient, db_session: AsyncSession):
    """Create admin + technician user, create sample."""
    from app.core.security import hash_password
    from app.models.user import User, Role
    from app.models.sample import Sample

    # Create users directly in DB
    admin = User(
        id="admin-1",
        username="admin",
        email="admin@example.com",
        hashed_password=hash_password("adminpass"),
        full_name="Admin",
        role=Role.ADMIN,
    )
    technician = User(
        id="tech-1",
        username="tech",
        email="tech@example.com",
        hashed_password=hash_password("techpass"),
        full_name="Technician",
        role=Role.TECHNICIAN,
    )
    db_session.add_all([admin, technician])
    await db_session.commit()

    # Login as admin
    resp = await client.post(
        "/api/v1/auth/login",
        data={"username": "admin", "password": "adminpass"},
    )
    token = resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Create sample
    resp = await client.post(
        "/api/v1/samples",
        json={
            "name": "水样-001",
            "category": "环境检测",
            "client_id": "client-1",
            "priority": "ROUTINE",
        },
        headers=headers,
    )
    assert resp.status_code == 201
    sample_data = resp.json()
    assert sample_data["name"] == "水样-001"
    assert sample_data["status"] == "RECEIVED"
    assert "sample_number" in sample_data