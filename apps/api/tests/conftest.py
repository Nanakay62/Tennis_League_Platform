"""Pytest test configuration and database fixtures."""

from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.db import Base, get_db
from app.main import app

# Test SQLite in-memory database
TEST_DB_URL = "sqlite+aiosqlite:///:memory:"

test_engine = create_async_engine(
    TEST_DB_URL,
    poolclass=StaticPool,
    connect_args={"check_same_thread": False},
    echo=False,
)
from sqlalchemy import event


@event.listens_for(test_engine.sync_engine, "connect")
def _fk_on(dbapi_conn, _):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = async_sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


@pytest.fixture(scope="session")
def anyio_backend():
    return "asyncio"


@pytest.fixture(autouse=True)
async def setup_database():
    """Create all tables before each test and drop them after."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest.fixture
async def seeded_catalog(db_session: AsyncSession) -> None:
    """Explicit fixture to seed Accra and Tema market, programs, divisions, and standings."""
    from app.seed import seed_accra_and_tema_market

    await seed_accra_and_tema_market(db_session)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """Yield an active db session for tests that need direct database access."""
    async with TestingSessionLocal() as session:
        yield session


@pytest.fixture
async def client() -> AsyncGenerator[AsyncClient, None]:
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def admin_headers(client: AsyncClient, db_session: AsyncSession) -> dict[str, str]:
    from sqlalchemy import select

    from app.identity.models import User, UserRole

    r = await client.post(
        "/auth/register",
        json={
            "email": "global_admin@accratennis.com",
            "password": "Password123!",
            "display_name": "Admin Tester",
            "home_area": "Accra",
        },
    )
    token = r.json()["access_token"]
    u = (
        await db_session.execute(select(User).where(User.email == "global_admin@accratennis.com"))
    ).scalar_one()
    u.role = UserRole.SUPER_ADMIN
    await db_session.commit()
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
async def player_headers(client: AsyncClient) -> dict[str, str]:
    r = await client.post(
        "/auth/register",
        json={
            "email": "test_player_fixture@accratennis.com",
            "password": "Password123!",
            "display_name": "Player Tester",
            "home_area": "Accra",
        },
    )
    token = r.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
