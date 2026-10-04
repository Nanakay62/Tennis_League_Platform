"""FastAPI endpoints for division playoffs, bracket generation, and match reporting."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division
from app.config import get_settings
from app.db import get_db
from app.identity.deps import get_current_admin_user
from app.identity.models import User
from app.matches.models import AuditLog
from app.playoffs.models import PlayoffBracket, PlayoffMatch
from app.playoffs.schemas import (
    GeneratePlayoffsRequest,
    PlayoffBracketResponse,
    PlayoffMatchResponse,
    ReportPlayoffScoreRequest,
)
from app.playoffs.service import (
    generate_division_playoffs,
    get_division_playoff_brackets,
    report_playoff_match_score,
)

settings = get_settings()
router = APIRouter(tags=["playoffs"])


@router.post(
    "/divisions/{division_id}/playoffs/generate",
    response_model=PlayoffBracketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_playoffs(
    division_id: str,
    req: GeneratePlayoffsRequest = GeneratePlayoffsRequest(),
    admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_db),
):
    """Generate the single-elimination championship playoff draw for a division (admin-only)."""
    division = (
        await session.execute(
            select(Division).where(
                Division.id == division_id, Division.market_id == admin.market_id
            )
        )
    ).scalar_one_or_none()
    if division is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Division not found.")

    min_wins = (
        division.playoff_min_wins
        if division.playoff_min_wins is not None
        else settings.playoff_min_wins
    )

    try:
        result = await generate_division_playoffs(
            session,
            division_id=division_id,
            min_wins=min_wins,
            enable_veteran_seeding=req.enable_veteran_seeding,
        )
        session.add(
            AuditLog(
                actor_id=admin.id,
                action="playoffs.generate",
                entity_type="division",
                entity_id=division_id,
                market_id=admin.market_id,
                reason="Championship playoffs generated",
            )
        )
        await session.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get(
    "/divisions/{division_id}/playoffs",
    response_model=list[PlayoffBracketResponse],
)
async def get_playoffs(
    division_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Retrieve all tournament brackets (championship & consolation) for a division."""
    return await get_division_playoff_brackets(session, division_id=division_id)


@router.post(
    "/playoffs/matches/{match_id}/score",
    response_model=PlayoffMatchResponse,
)
async def report_score(
    match_id: str,
    req: ReportPlayoffScoreRequest,
    admin: User = Depends(get_current_admin_user),
    session: AsyncSession = Depends(get_db),
):
    """Report a playoff match score and advance the winner to the next round (admin-only)."""
    match_res = await session.execute(select(PlayoffMatch).where(PlayoffMatch.id == match_id))
    match = match_res.scalar_one_or_none()
    if not match:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Playoff match not found."
        )

    bracket_res = await session.execute(
        select(PlayoffBracket).where(PlayoffBracket.id == match.bracket_id)
    )
    bracket = bracket_res.scalar_one_or_none()
    if not bracket:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bracket not found.")

    div_res = await session.execute(
        select(Division).where(
            Division.id == bracket.division_id, Division.market_id == admin.market_id
        )
    )
    division = div_res.scalar_one_or_none()
    if not division:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Division not found in your market."
        )

    if match.winner_id is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="Playoff match already scored."
        )

    try:
        result = await report_playoff_match_score(
            session,
            match_id=match_id,
            winner_id=req.winner_id,
            score_summary=req.score_summary,
        )
        session.add(
            AuditLog(
                actor_id=admin.id,
                action="playoffs.score",
                entity_type="playoff_match",
                entity_id=match_id,
                market_id=admin.market_id,
                reason=f"Playoff match scored with winner {req.winner_id}",
            )
        )
        await session.commit()
        return result
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
