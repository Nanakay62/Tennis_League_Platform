"""FastAPI endpoints for courts directory, partner program, POTY leaderboard, and referrals."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.community.schemas import (
    CourtDetailResponse,
    CourtResponse,
    CourtReviewResponse,
    CreateCourtReviewRequest,
    PartnerMatchResponse,
    POTYItemResponse,
    ReferralInfoResponse,
)
from app.community.service import (
    add_court_review,
    find_matching_partners,
    get_court_detail,
    get_courts_directory,
    get_market_poty_leaderboard,
    get_or_create_user_referral_info,
)
from app.db import get_db
from app.identity.deps import get_current_user
from app.identity.models import User
from app.identity.service import get_or_create_default_market

router = APIRouter(tags=["community"])


@router.get("/partners", response_model=list[PartnerMatchResponse])
async def get_compatible_partners(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Find compatible hitting partners for current user within ±0.5 NTRP in their market."""
    try:
        return await find_matching_partners(session, user=user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/courts", response_model=list[CourtResponse])
async def list_courts(
    surface: str | None = Query(None, description="Filter by surface (clay, hard, carpet, grass)"),
    has_lights: bool | None = Query(None, description="Filter by floodlights"),
    is_indoor: bool | None = Query(None, description="Filter indoor/outdoor"),
    has_hitting_wall: bool | None = Query(None, description="Filter hitting wall"),
    session: AsyncSession = Depends(get_db),
):
    """List tennis courts in the Frankfurt market with amenity filters."""
    default_market = await get_or_create_default_market(session)
    return await get_courts_directory(
        session,
        market_id=default_market.id,
        surface=surface,
        has_lights=has_lights,
        is_indoor=is_indoor,
        has_hitting_wall=has_hitting_wall,
    )


@router.get("/courts/{court_id}", response_model=CourtDetailResponse)
async def get_court(
    court_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Retrieve full court detail with player reviews and ratings."""
    try:
        return await get_court_detail(session, court_id=court_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post(
    "/courts/{court_id}/reviews",
    response_model=CourtReviewResponse,
    status_code=status.HTTP_201_CREATED,
)
async def post_court_review(
    court_id: str,
    req: CreateCourtReviewRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Submit a rating (1-5) and review for a tennis court."""
    try:
        return await add_court_review(session, court_id=court_id, user=user, req=req)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/community/poty", response_model=list[POTYItemResponse])
async def get_poty_leaderboard(
    session: AsyncSession = Depends(get_db),
):
    """Retrieve the annual Player of the Year (POTY) rankings."""
    default_market = await get_or_create_default_market(session)
    return await get_market_poty_leaderboard(session, market_id=default_market.id)


@router.get("/community/referral", response_model=ReferralInfoResponse)
async def get_referral_info(
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Retrieve personal referral code, shareable link, and reward balance."""
    return await get_or_create_user_referral_info(session, user=user)
