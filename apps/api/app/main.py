"""FastAPI application factory, routers, and health checks."""

from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.admin import setup_admin
from app.admin_actions.routes import router as admin_actions_router
from app.billing import models as _billing_models  # noqa: F401
from app.billing.routes import router as billing_router
from app.catalog import models as _catalog_models  # noqa: F401
from app.community import models as _community_models  # noqa: F401
from app.community.routes import router as community_router
from app.config import get_settings
from app.db import Base, engine, get_db
from app.domain.standings import (
    DivisionRules,
    compute_standings,
)
from app.domain.standings import (
    StandingRow as DomainStandingRow,
)
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

settings = get_settings()


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
app.include_router(matches_router)
app.include_router(playoffs_router)
app.include_router(community_router)
app.include_router(notify_router)
app.include_router(admin_actions_router)

# SQLAdmin back office mount at /admin
admin = setup_admin(app)

# Mount local media directory for avatars in sandbox / local development mode
import os

from fastapi.staticfiles import StaticFiles

os.makedirs("media", exist_ok=True)
app.mount("/media", StaticFiles(directory="media"), name="media")


# Pydantic Schemas for API contract
class HealthResponse(BaseModel):
    status: str
    environment: str
    market: str
    timezone: str
    database: str = "ok"


class ProgramResponse(BaseModel):
    id: str
    name: str
    type: str
    startDate: str
    endDate: str
    status: str
    priceCents: int
    currency: str


class DivisionResponse(BaseModel):
    id: str
    programId: str
    name: str
    ratingBand: str
    playersCount: int


class StandingRowResponse(BaseModel):
    rank: int
    playerId: str
    playerName: str
    homeArea: str
    isDaytime: bool
    wins: int
    losses: int
    gamesWon: int
    gamesLost: int
    gamesPct: float
    gamesPctDisplay: str
    playoffIndicator: str
    isPlayoffEligible: bool


# Mock in-memory state for initial vertical slice
FRANKFURT_PROGRAMS = [
    {
        "id": "prog-frankfurt-fall-2026",
        "name": "Frankfurt Fall Season 2026",
        "type": "FLEX_SEASON",
        "startDate": "2026-10-01",
        "endDate": "2026-11-20",
        "status": "Open for Enrollment",
        "priceCents": 3495,
        "currency": "EUR",
    }
]

FRANKFURT_DIVISIONS = [
    {
        "id": "div-comp-1",
        "programId": "prog-frankfurt-fall-2026",
        "name": "Competitive (3.5)",
        "ratingBand": "3.5",
        "playersCount": 6,
    },
    {
        "id": "div-skilled-1",
        "programId": "prog-frankfurt-fall-2026",
        "name": "Skilled (3.0)",
        "ratingBand": "3.0",
        "playersCount": 6,
    },
]

# Raw seed players and records for Phase 2 vertical slice
SEED_PLAYERS_RAW = [
    DomainStandingRow(
        player_id="p1",
        player_name="Lukas Schmidt",
        home_area="Sachsenhausen",
        is_daytime=True,
        wins=5,
        losses=1,
        games_won=36,
        games_lost=15,
        distinct_opponents=5,
        is_new_player=False,
    ),
    DomainStandingRow(
        player_id="p2",
        player_name="Maximilian Weber",
        home_area="Westend",
        is_daytime=False,
        wins=4,
        losses=2,
        games_won=30,
        games_lost=22,
        distinct_opponents=4,
        is_new_player=False,
    ),
    DomainStandingRow(
        player_id="p3",
        player_name="Felix Fischer",
        home_area="Nordend",
        is_daytime=True,
        wins=3,
        losses=3,
        games_won=25,
        games_lost=25,
        distinct_opponents=4,
        is_new_player=True,
    ),
    DomainStandingRow(
        player_id="p4",
        player_name="Stefan Meyer",
        home_area="Bornheim",
        is_daytime=False,
        wins=2,
        losses=4,
        games_won=18,
        games_lost=31,
        distinct_opponents=3,
        is_new_player=False,
    ),
]


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


@app.get("/programs", response_model=list[ProgramResponse])
async def list_programs() -> list[dict[str, Any]]:
    """List available league programs in the current market."""
    return FRANKFURT_PROGRAMS


@app.get("/programs/{program_id}/divisions", response_model=list[DivisionResponse])
async def list_program_divisions(program_id: str) -> list[dict[str, Any]]:
    """List divisions belonging to a given program."""
    divs = [d for d in FRANKFURT_DIVISIONS if d["programId"] == program_id]
    if not divs:
        # Fallback to returning divisions for demo/testing
        return FRANKFURT_DIVISIONS
    return divs


@app.get("/divisions/{division_id}/standings", response_model=list[StandingRowResponse])
async def get_division_standings(division_id: str) -> list[StandingRowResponse]:
    """Retrieve computed standings for a division, sorted by domain rules."""
    rules = DivisionRules(
        playoff_min_wins=settings.playoff_min_wins,
        new_player_min_matches=settings.new_player_min_matches,
    )
    # Compute rankings using pure domain engine
    ranked_rows = compute_standings(list(SEED_PLAYERS_RAW), rules=rules)

    return [
        StandingRowResponse(
            rank=r.rank,
            playerId=r.player_id,
            playerName=r.player_name,
            homeArea=r.home_area,
            isDaytime=r.is_daytime,
            wins=r.wins,
            losses=r.losses,
            gamesWon=r.games_won,
            gamesLost=r.games_lost,
            gamesPct=r.games_pct,
            gamesPctDisplay=r.games_pct_display,
            playoffIndicator=r.playoff_indicator,
            isPlayoffEligible=r.is_playoff_eligible,
        )
        for r in ranked_rows
    ]
