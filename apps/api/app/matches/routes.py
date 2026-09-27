"""Match reporting, confirmation, disputes, rosters, and scores feed API routes."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_db
from app.identity.deps import get_current_user
from app.identity.models import User
from app.matches.schemas import (
    DisputeMatchRequest,
    LatestScoreFeedItem,
    MatchResponse,
    RosterPlayerResponse,
    SubmitMatchRequest,
)
from app.matches.service import (
    confirm_match,
    dispute_match,
    get_division_roster,
    get_latest_scores_feed,
    submit_match,
)

router = APIRouter(tags=["matches"])


@router.post("/matches", response_model=MatchResponse, status_code=status.HTTP_201_CREATED)
async def report_match(
    req: SubmitMatchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Submit a reported match score with format validation and rematch limits."""
    try:
        match = await submit_match(session, reporter_user=user, req=req)
        return MatchResponse(
            id=match.id,
            division_id=match.division_id,
            winner_id=match.winner_id,
            loser_id=match.loser_id,
            winner_name="Winner",
            loser_name="Opponent",
            format=match.format,
            outcome_type=match.outcome_type,
            sets_summary="Score reported",
            status=match.status,
            played_at=match.played_at.isoformat(),
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/matches/{match_id}/confirm", response_model=dict)
async def confirm_match_score(
    match_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Opponent confirms a reported match score."""
    try:
        match = await confirm_match(session, user, match_id)
        return {"status": "success", "match_id": match.id, "match_status": match.status}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.post("/matches/{match_id}/dispute", response_model=dict)
async def dispute_match_score(
    match_id: str,
    req: DisputeMatchRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Opponent disputes a reported score, starting a 24h cooling-off window."""
    try:
        match = await dispute_match(session, user, match_id, req.reason)
        return {"status": "success", "match_id": match.id, "match_status": match.status}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/divisions/{division_id}/roster", response_model=list[RosterPlayerResponse])
async def list_division_roster(
    division_id: str,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Get opponent roster with contact details (strictly gated to paid division enrollees)."""
    try:
        return await get_division_roster(session, division_id, user)
    except PermissionError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))


@router.get("/scores/latest", response_model=list[LatestScoreFeedItem])
async def latest_scores_feed(
    limit: int = Query(default=20, le=50),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve public market-wide feed of latest confirmed match scores."""
    return await get_latest_scores_feed(session, limit=limit)
