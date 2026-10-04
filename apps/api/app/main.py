"""FastAPI application factory, routers, and health checks."""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import setup_admin
from app.admin_actions.routes import router as admin_actions_router
from app.billing import models as _billing_models  # noqa: F401
from app.billing.routes import router as billing_router
from app.catalog import models as _catalog_models  # noqa: F401
from app.catalog.routes import router as catalog_router
from app.community import models as _community_models  # noqa: F401
from app.community.routes import router as community_router
from app.config import get_settings
from app.db import Base, async_session_maker, engine, get_db
from app.identity import models as _identity_models  # noqa: F401
from app.identity.routes import router as identity_router
from app.leagues import models as _leagues_models  # noqa: F401
from app.markets import models as _markets_models  # noqa: F401
from app.matches import models as _matches_models  # noqa: F401
from app.matches.routes import router as matches_router
from app.notify import models as _notify_models  # noqa: F401
from app.notify.routes import router as notify_router
from app.playoffs import models as _playoffs_models  # noqa: F401
from app.playoffs.routes import router as playoffs_router
from app.seed import seed_accra_and_tema_market

logger = logging.getLogger(__name__)
settings = get_settings()


async def maybe_seed(session: AsyncSession) -> None:
    """Run initial demo seeding only if SEED_DEMO_DATA is enabled."""
    if settings.SEED_DEMO_DATA:
        if not settings.SEED_DEMO_PASSWORD:
            raise ValueError("SEED_DEMO_PASSWORD must be configured when SEED_DEMO_DATA is True")
        await seed_accra_and_tema_market(session)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize Sentry error reporting if configured
    if settings.SENTRY_DSN:
        import sentry_sdk

        sentry_sdk.init(
            dsn=settings.SENTRY_DSN,
            environment=settings.ENVIRONMENT,
            traces_sample_rate=1.0 if settings.ENVIRONMENT != "production" else 0.1,
        )

    # Auto-initialize database tables if using SQLite or test database
    if "sqlite" in settings.DATABASE_URL:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

    # Guarded seeding for initial programs, divisions, and baseline records
    try:
        async with async_session_maker() as seed_session:
            await maybe_seed(seed_session)
    except (SQLAlchemyError, ValueError) as e:
        logger.warning("Startup seeding notice: %s", e)

    yield


app = FastAPI(
    title="Tennis League Platform API",
    version="1.0.0",
    description="Cross-platform flex tennis league backend API",
    lifespan=lifespan,
)

# CORS configuration - strictly restricted for production security
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https://.*\.vercel\.app$",
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "Origin", "X-Request-ID"],
)

app.include_router(identity_router)
app.include_router(billing_router)
app.include_router(catalog_router)
app.include_router(matches_router)
app.include_router(playoffs_router)
app.include_router(community_router)
app.include_router(notify_router)
app.include_router(admin_actions_router)

# SQLAdmin back office mount at /admin
admin = setup_admin(app)

# Mount local media directory for avatars in sandbox / local development mode
os.makedirs("media", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")


# Pydantic Schema for Health Check API contract
class HealthResponse(BaseModel):
    status: str
    environment: str
    market: str
    timezone: str
    database: str = "ok"


@app.get("/health", response_model=HealthResponse)
async def health_check(session: AsyncSession = Depends(get_db)) -> HealthResponse:
    """Service liveness, database connectivity, and market status check."""
    from sqlalchemy import text
    from sqlalchemy.exc import SQLAlchemyError

    db_status = "ok"
    try:
        await session.execute(text("SELECT 1"))
    except (SQLAlchemyError, OSError) as e:
        db_status = f"unhealthy: {type(e).__name__}"

    return HealthResponse(
        status="ok" if db_status == "ok" else "degraded",
        environment=settings.ENVIRONMENT,
        market=settings.DEFAULT_MARKET_NAME,
        timezone=settings.DEFAULT_MARKET_TIMEZONE,
        database=db_status,
    )
