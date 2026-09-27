"""FastAPI endpoints for division playoffs, bracket generation, and match reporting."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
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

router = APIRouter(tags=["playoffs"])


@router.post(
    "/divisions/{division_id}/playoffs/generate",
    response_model=PlayoffBracketResponse,
    status_code=status.HTTP_201_CREATED,
)
async def generate_playoffs(
    division_id: str,
    req: GeneratePlayoffsRequest = GeneratePlayoffsRequest(),
    session: AsyncSession = Depends(get_db),
):
    """Generate the single-elimination championship playoff draw for a division."""
    try:
        return await generate_division_playoffs(
            session,
            division_id=division_id,
            min_wins=req.min_wins,
            enable_veteran_seeding=req.enable_veteran_seeding,
        )
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
    session: AsyncSession = Depends(get_db),
):
    """Report a playoff match score and advance the winner to the next round."""
    try:
        return await report_playoff_match_score(
            session,
            match_id=match_id,
            winner_id=req.winner_id,
            score_summary=req.score_summary,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
