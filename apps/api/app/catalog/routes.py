import logging
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division, Program
from app.catalog.schemas import DivisionResponse, ProgramResponse, StandingRowResponse
from app.config import get_settings
from app.db import get_db
from app.identity.models import PlayerProfile
from app.leagues.models import Enrollment, EnrollmentStatus, StandingRowModel

logger = logging.getLogger(__name__)
settings = get_settings()

router = APIRouter(tags=["catalog"])


@router.get("/programs", response_model=list[ProgramResponse])
async def list_programs(
    market_id: str | None = Query(default=None),
    session: AsyncSession = Depends(get_db),
) -> list[dict[str, Any]]:
    """List available league programs in the database for the given or default market."""
    target_market_id = market_id or settings.DEFAULT_MARKET_ID
    stmt = (
        select(Program)
        .where(Program.market_id == target_market_id)
        .order_by(Program.start_date.desc())
    )
    res = await session.execute(stmt)
    programs = res.scalars().all()

    return [
        {
            "id": p.id,
            "name": p.name,
            "type": p.program_type,
            "startDate": p.start_date.isoformat(),
            "endDate": p.end_date.isoformat(),
            "status": p.status,
            "priceCents": p.price_cents,
            "currency": p.currency,
        }
        for p in programs
    ]


@router.get("/programs/{program_id}/divisions", response_model=list[DivisionResponse])
async def list_program_divisions(
    program_id: str, session: AsyncSession = Depends(get_db)
) -> list[dict[str, Any]]:
    """List divisions belonging to a given program, with real enrolled player counts."""
    div_stmt = (
        select(Division).where(Division.program_id == program_id).order_by(Division.name.asc())
    )
    div_res = await session.execute(div_stmt)
    divisions = div_res.scalars().all()

    if not divisions:
        return []

    div_ids = [d.id for d in divisions]
    count_stmt = (
        select(Enrollment.division_id, func.count(Enrollment.id))
        .where(
            Enrollment.division_id.in_(div_ids),
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.PLACED_IN_DIVISION]),
        )
        .group_by(Enrollment.division_id)
    )
    count_res = await session.execute(count_stmt)
    counts: dict[str, int] = {row[0]: int(row[1]) for row in count_res.all() if row[0] is not None}

    return [
        {
            "id": d.id,
            "programId": d.program_id,
            "name": d.name,
            "ratingBand": d.rating_band,
            "playersCount": counts.get(d.id, 0),
            "genderConstraint": d.gender_constraint,
            "minAge": d.min_age,
        }
        for d in divisions
    ]


@router.get("/divisions/{division_id}/standings", response_model=list[StandingRowResponse])
async def get_division_standings(
    division_id: str, session: AsyncSession = Depends(get_db)
) -> list[StandingRowResponse]:
    """Retrieve computed standings for a division directly from the database."""
    div_stmt = select(Division).where(Division.id == division_id)
    division = (await session.execute(div_stmt)).scalar_one_or_none()
    if division is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Division '{division_id}' not found.",
        )

    stmt = (
        select(StandingRowModel, PlayerProfile)
        .join(PlayerProfile, StandingRowModel.player_id == PlayerProfile.id)
        .where(StandingRowModel.division_id == division_id)
        .order_by(StandingRowModel.rank.asc())
    )
    res = await session.execute(stmt)
    rows = res.all()

    results: list[StandingRowResponse] = []
    for standing, profile in rows:
        total_games = standing.games_won + standing.games_lost
        pct = round(standing.games_won / total_games, 3) if total_games > 0 else 0.0
        pct_display = f"{pct:.3f} ({standing.games_won}-{standing.games_lost})"

        results.append(
            StandingRowResponse(
                rank=standing.rank,
                playerId=standing.player_id,
                playerName=profile.display_name,
                homeArea=profile.home_area or "",
                isDaytime=profile.is_daytime,
                wins=standing.wins,
                losses=standing.losses,
                gamesWon=standing.games_won,
                gamesLost=standing.games_lost,
                gamesPct=pct,
                gamesPctDisplay=pct_display,
                playoffIndicator=standing.playoff_indicator,
                isPlayoffEligible=standing.is_playoff_eligible,
            )
        )

    return results
