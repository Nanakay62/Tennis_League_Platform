"""Community services: partner matching, courts directory, reviews, POTY, and referrals."""

from collections import defaultdict

from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.community.models import Court, CourtReview, Referral
from app.config import get_settings

settings = get_settings()
from app.community.schemas import (
    CourtDetailResponse,
    CourtResponse,
    CourtReviewResponse,
    CreateCourtReviewRequest,
    PartnerMatchResponse,
    POTYItemResponse,
    ReferralInfoResponse,
)
from app.domain.partners import (
    CandidatePartner,
    PlayerMatchRecord,
    compute_poty_leaderboard,
    filter_and_rank_partners,
)
from app.identity.models import PlayerProfile, User
from app.leagues.models import Enrollment, EnrollmentStatus
from app.matches.models import Match, MatchStatus


async def find_matching_partners(
    session: AsyncSession,
    user: User,
    limit: int = 20,
) -> list[PartnerMatchResponse]:
    """Find and rank compatible hitting partners in the user's market within ±0.5 NTRP."""
    # Load user's profile
    user_prof_res = await session.execute(
        select(PlayerProfile).where(PlayerProfile.user_id == user.id)
    )
    user_prof = user_prof_res.scalar_one_or_none()
    if not user_prof:
        raise ValueError("Player profile required to match with partners.")

    if not (user_prof.home_area or "").strip():
        return []

    # Load other active players in the same market and exact same home area
    conditions = [
        PlayerProfile.market_id == user.market_id,
        PlayerProfile.user_id != user.id,
        User.is_active.is_(True),
        func.lower(func.trim(PlayerProfile.home_area)) == func.lower(user_prof.home_area.strip()),
    ]

    stmt = (
        select(PlayerProfile, User).join(User, PlayerProfile.user_id == User.id).where(*conditions)
    )
    res = await session.execute(stmt)
    rows = res.all()

    if not rows:
        return []

    # Count previous matches played together to encourage diversity
    matches_stmt = select(Match).where(
        Match.market_id == user.market_id,
        or_(
            Match.winner_id == user_prof.id,
            Match.loser_id == user_prof.id,
        ),
    )
    matches_res = await session.execute(matches_stmt)
    played_counts: dict[str, int] = defaultdict(int)
    for m in matches_res.scalars().all():
        opponent_id = m.loser_id if m.winner_id == user_prof.id else m.winner_id
        played_counts[opponent_id] += 1

    # Check if requesting user has an active or placed enrollment (Rule 5 contact details restriction)
    has_active_stmt = (
        select(Enrollment.id)
        .where(
            Enrollment.user_id == user.id,
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.PLACED_IN_DIVISION]),
        )
        .limit(1)
    )
    has_active = (await session.execute(has_active_stmt)).first() is not None

    candidates: list[CandidatePartner] = []
    for prof, u in rows:
        candidates.append(
            CandidatePartner(
                player_id=prof.id,
                display_name=prof.display_name,
                rating=prof.rating,
                home_area=prof.home_area,
                is_daytime=prof.is_daytime,
                phone=prof.phone if has_active else None,
                email=u.email if has_active else None,
                matches_played_together=played_counts[prof.id],
            )
        )

    # Rank candidates using pure domain algorithm
    ranked = filter_and_rank_partners(
        target_rating=user_prof.rating,
        target_home_area=user_prof.home_area,
        target_is_daytime=user_prof.is_daytime,
        candidates=candidates,
        max_rating_diff=0.5,
        limit=limit,
    )

    return [
        PartnerMatchResponse(
            player_id=c.player_id,
            display_name=c.display_name,
            rating=c.rating,
            home_area=c.home_area,
            is_daytime=c.is_daytime,
            phone=c.phone,
            email=c.email,
        )
        for c in ranked
    ]


async def get_courts_directory(
    session: AsyncSession,
    market_id: str,
    surface: str | None = None,
    has_lights: bool | None = None,
    is_indoor: bool | None = None,
    has_hitting_wall: bool | None = None,
) -> list[CourtResponse]:
    """Retrieve courts with optional filter criteria and aggregate ratings."""
    query = select(Court).where(Court.market_id == market_id)

    if surface:
        query = query.where(Court.surface == surface.lower())
    if has_lights is not None:
        query = query.where(Court.has_lights == has_lights)
    if is_indoor is not None:
        query = query.where(Court.is_indoor == is_indoor)
    if has_hitting_wall is not None:
        query = query.where(Court.has_hitting_wall == has_hitting_wall)

    courts_res = await session.execute(query)
    courts = courts_res.scalars().all()

    results: list[CourtResponse] = []
    for c in courts:
        # Calculate rating
        rating_stmt = select(
            func.coalesce(func.avg(CourtReview.rating), 0.0),
            func.count(CourtReview.id),
        ).where(CourtReview.court_id == c.id)
        avg_rating, count = (await session.execute(rating_stmt)).one()

        results.append(
            CourtResponse(
                id=c.id,
                name=c.name,
                slug=c.slug,
                address=c.address,
                postal_code=c.postal_code,
                city=c.city,
                latitude=c.latitude,
                longitude=c.longitude,
                num_courts=c.num_courts,
                surface=c.surface,
                has_lights=c.has_lights,
                is_indoor=c.is_indoor,
                has_hitting_wall=c.has_hitting_wall,
                booking_url=c.booking_url,
                average_rating=round(float(avg_rating), 1),
                review_count=int(count),
            )
        )
    return results


async def get_court_detail(
    session: AsyncSession, court_id: str, market_id: str | None = None
) -> CourtDetailResponse:
    """Retrieve detailed court information including all reviews."""
    stmt = select(Court).where(Court.id == court_id).options(selectinload(Court.reviews))
    if market_id:
        stmt = stmt.where(Court.market_id == market_id)
    res = await session.execute(stmt)
    court = res.scalar_one_or_none()
    if not court:
        raise ValueError(f"Court '{court_id}' not found.")

    rating_stmt = select(
        func.coalesce(func.avg(CourtReview.rating), 0.0),
        func.count(CourtReview.id),
    ).where(CourtReview.court_id == court.id)
    avg_rating, count = (await session.execute(rating_stmt)).one()

    reviews = [
        CourtReviewResponse(
            id=r.id,
            user_id=r.user_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at.isoformat(),
        )
        for r in sorted(court.reviews, key=lambda x: x.created_at, reverse=True)
    ]

    return CourtDetailResponse(
        id=court.id,
        name=court.name,
        slug=court.slug,
        address=court.address,
        postal_code=court.postal_code,
        city=court.city,
        latitude=court.latitude,
        longitude=court.longitude,
        num_courts=court.num_courts,
        surface=court.surface,
        has_lights=court.has_lights,
        is_indoor=court.is_indoor,
        has_hitting_wall=court.has_hitting_wall,
        booking_url=court.booking_url,
        average_rating=round(float(avg_rating), 1),
        review_count=int(count),
        reviews=reviews,
    )


async def add_court_review(
    session: AsyncSession,
    court_id: str,
    user: User,
    req: CreateCourtReviewRequest,
    market_id: str | None = None,
) -> CourtReviewResponse:
    """Submit or update a rating and review for a tennis court (1 review per user)."""
    query = select(Court).where(Court.id == court_id)
    if market_id:
        query = query.where(Court.market_id == market_id)
    court_res = await session.execute(query)
    if not court_res.scalar_one_or_none():
        raise ValueError(f"Court '{court_id}' not found.")

    existing_stmt = select(CourtReview).where(
        CourtReview.court_id == court_id,
        CourtReview.user_id == user.id,
    )
    existing = (await session.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        existing.rating = req.rating
        existing.comment = req.comment
        review = existing
    else:
        review = CourtReview(
            court_id=court_id,
            user_id=user.id,
            rating=req.rating,
            comment=req.comment,
        )
        session.add(review)
    await session.commit()

    return CourtReviewResponse(
        id=review.id,
        user_id=review.user_id,
        rating=review.rating,
        comment=review.comment,
        created_at=review.created_at.isoformat(),
    )


async def get_market_poty_leaderboard(
    session: AsyncSession,
    market_id: str,
) -> list[POTYItemResponse]:
    """Calculate market-wide Player of the Year standings from verified matches."""
    # Load all confirmed matches in market
    matches_stmt = select(Match).where(
        Match.market_id == market_id,
        Match.status == MatchStatus.CONFIRMED,
    )
    matches_res = await session.execute(matches_stmt)
    matches = matches_res.scalars().all()

    # Aggregate stats per player profile id
    played: dict[str, int] = defaultdict(int)
    wins: dict[str, int] = defaultdict(int)
    opponents: dict[str, set[str]] = defaultdict(set)

    for m in matches:
        played[m.winner_id] += 1
        played[m.loser_id] += 1
        wins[m.winner_id] += 1
        opponents[m.winner_id].add(m.loser_id)
        opponents[m.loser_id].add(m.winner_id)

    if not played:
        return []

    # Load player profiles
    profiles_res = await session.execute(
        select(PlayerProfile).where(PlayerProfile.id.in_(played.keys()))
    )
    profiles = {p.id: p for p in profiles_res.scalars().all()}

    records: list[PlayerMatchRecord] = []
    for p_id, matches_count in played.items():
        prof = profiles.get(p_id)
        if prof:
            records.append(
                PlayerMatchRecord(
                    player_id=p_id,
                    display_name=prof.display_name,
                    home_area=prof.home_area,
                    rating=prof.rating,
                    matches_played=matches_count,
                    matches_won=wins[p_id],
                    distinct_opponents=len(opponents[p_id]),
                )
            )

    poty_scores = compute_poty_leaderboard(records)

    return [
        POTYItemResponse(
            rank=s.rank,
            player_id=s.player_id,
            display_name=s.display_name,
            total_points=s.total_points,
            matches_played=s.matches_played,
            matches_won=s.matches_won,
            distinct_opponents=s.distinct_opponents,
            home_area=s.home_area,
        )
        for s in poty_scores
    ]


async def get_or_create_user_referral_info(
    session: AsyncSession,
    user: User,
) -> ReferralInfoResponse:
    """Retrieve or generate user's personal referral code and credit track record."""
    ref_stmt = select(Referral).where(Referral.referrer_id == user.id).order_by(Referral.created_at)
    ref_res = await session.execute(ref_stmt)
    referrals = ref_res.scalars().all()

    if referrals:
        code = referrals[0].referral_code
    else:
        import secrets

        # Create a clean referral code without leaking email or identity details
        code = f"TENNIS-{secrets.token_hex(3).upper()}"
        initial_ref = Referral(
            referrer_id=user.id,
            referral_code=code,
            reward_credit_cents=500,
            status="pending",
        )
        session.add(initial_ref)
        await session.commit()
        referrals = [initial_ref]

    completed = sum(1 for r in referrals if r.status == "completed")
    pending = sum(1 for r in referrals if r.status == "pending" and r.referred_user_id is not None)

    return ReferralInfoResponse(
        referral_code=code,
        referral_link=f"{settings.PUBLIC_WEB_URL}/join?ref={code}",
        reward_credit_cents=500,
        completed_referrals_count=completed,
        pending_referrals_count=pending,
    )
