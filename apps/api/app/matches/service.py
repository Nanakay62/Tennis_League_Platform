"""Matches service: submission validation, confirmation, disputes, standings recalculation, and rosters."""

import json
from datetime import UTC, datetime, timedelta

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.catalog.models import Division
from app.config import get_settings
from app.domain.discipline import (
    check_rematch_eligibility,
    evaluate_cancellation_strike,
    evaluate_no_show_strike,
)
from app.domain.scoring import (
    MatchFormat,
    OutcomeType,
    evaluate_handicap_eligibility,
    validate_result,
)
from app.domain.scoring import (
    SetScore as DomainSetScore,
)
from app.domain.standings import (
    DivisionRules,
    compute_standings,
)
from app.domain.standings import (
    StandingRow as DomainStandingRow,
)
from app.identity.models import PlayerProfile, User
from app.leagues.models import Enrollment, EnrollmentStatus, StandingRowModel
from app.matches.models import (
    AuditLog,
    DisputeStatus,
    Match,
    MatchDispute,
    MatchStatus,
    Strike,
    StrikeStatus,
)
from app.matches.schemas import (
    HandicapCheckResponse,
    LatestScoreFeedItem,
    RosterPlayerResponse,
    SubmitMatchRequest,
)

settings = get_settings()


def parse_rating(val: str | None) -> float | None:
    """Parse rating string to float, returning None if unrated or invalid."""
    if not val:
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


async def count_player_confirmed_matches(session: AsyncSession, player_id: str) -> int:
    """Count confirmed matches played on platform plus any historical imported veteran matches."""
    stmt = select(func.count(Match.id)).where(
        (Match.winner_id == player_id) | (Match.loser_id == player_id),
        Match.status == MatchStatus.CONFIRMED,
    )
    res = await session.execute(stmt)
    db_matches = res.scalar_one() or 0

    prof_stmt = select(PlayerProfile.veteran_match_count).where(PlayerProfile.id == player_id)
    prof_vet = (await session.execute(prof_stmt)).scalar_one_or_none() or 0
    return max(db_matches, prof_vet)


async def _require_division_and_enrollment(
    db: AsyncSession, division_id: str, market_id: str, *user_ids: str
) -> Division:
    """Ensure division exists in user's market and all specified users are actively enrolled."""
    div = (
        await db.execute(
            select(Division).where(Division.id == division_id, Division.market_id == market_id)
        )
    ).scalar_one_or_none()
    if div is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Division '{division_id}' not found.",
        )
    for uid in user_ids:
        enr = (
            await db.execute(
                select(Enrollment).where(
                    Enrollment.user_id == uid,
                    Enrollment.division_id == division_id,
                    Enrollment.status.in_(
                        [EnrollmentStatus.ACTIVE, EnrollmentStatus.PLACED_IN_DIVISION]
                    ),
                )
            )
        ).first()
        if enr is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Both players must be actively enrolled in this division.",
            )
    return div


async def _assert_is_counterparty(session: AsyncSession, user: User, match: Match) -> None:
    """Ensure user is the opposing counterparty in a match, not the reporter or an uninvolved player."""
    if user.id == match.reporter_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opposing player can confirm or dispute this result.",
        )
    prof_id = (
        await session.execute(select(PlayerProfile.id).where(PlayerProfile.user_id == user.id))
    ).scalar_one_or_none()
    if not prof_id or prof_id not in (match.winner_id, match.loser_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the opposing player can confirm or dispute this result.",
        )


async def check_handicap_eligibility_for_players(
    session: AsyncSession,
    user: User,
    opponent_id: str,
) -> HandicapCheckResponse:
    """Check handicap scoring eligibility between current player and opponent."""
    stmt_my = select(PlayerProfile).where(PlayerProfile.user_id == user.id)
    my_profile = (await session.execute(stmt_my)).scalar_one_or_none()
    if not my_profile:
        raise ValueError("User does not have an active player profile.")

    stmt_opp = (
        select(PlayerProfile)
        .join(User, PlayerProfile.user_id == User.id)
        .where(PlayerProfile.id == opponent_id, User.market_id == user.market_id)
    )
    opp_profile = (await session.execute(stmt_opp)).scalar_one_or_none()
    if not opp_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opponent profile not found.",
        )

    my_matches = await count_player_confirmed_matches(session, my_profile.id)
    opp_matches = await count_player_confirmed_matches(session, opp_profile.id)

    my_rating = parse_rating(my_profile.rating)
    opp_rating = parse_rating(opp_profile.rating)

    eligible, reason, headstart = evaluate_handicap_eligibility(
        player_a_id=my_profile.id,
        player_a_rating=my_rating,
        player_a_matches=my_matches,
        player_b_id=opp_profile.id,
        player_b_rating=opp_rating,
        player_b_matches=opp_matches,
        min_qualifying_matches=settings.HANDICAP_MIN_MATCHES,
    )

    lower_name = None
    if headstart:
        lower_name = (
            my_profile.display_name
            if headstart.lower_rated_player_id == my_profile.id
            else opp_profile.display_name
        )

    gap = (
        round(abs(my_rating - opp_rating), 2)
        if (my_rating is not None and opp_rating is not None)
        else 0.0
    )
    return HandicapCheckResponse(
        eligible=eligible,
        reason=reason,
        lead=headstart.lead if headstart else None,
        court=headstart.court if headstart else None,
        lower_rated_player_id=headstart.lower_rated_player_id if headstart else None,
        lower_rated_player_name=lower_name,
        rating_gap=gap,
        my_match_count=my_matches,
        opponent_match_count=opp_matches,
        min_qualifying_matches=settings.HANDICAP_MIN_MATCHES,
    )


def format_sets_summary(sets_data: list[dict], fmt: str) -> str:
    """Format sets for display: e.g. 6-2; 3-6; TB 10-8."""
    parts = []
    for s in sets_data:
        w, l = s.get("winner", 0), s.get("loser", 0)
        if s.get("super_tiebreak"):
            parts.append(f"TB {w}-{l}")
        else:
            parts.append(f"{w}-{l}")
    return "; ".join(parts)


async def submit_match(
    session: AsyncSession,
    reporter_user: User,
    req: SubmitMatchRequest,
) -> tuple[Match, str, str, str]:
    """Validate and record a reported match result."""
    now_utc = datetime.now(UTC)

    # 1. Verify reporter has a player profile
    stmt_prof = select(PlayerProfile).where(PlayerProfile.user_id == reporter_user.id)
    reporter_profile = (await session.execute(stmt_prof)).scalar_one_or_none()
    if not reporter_profile:
        raise ValueError("Reporter does not have an active player profile.")

    # 2. Verify opponent exists and is in the same market
    stmt_opp = (
        select(PlayerProfile)
        .join(User, PlayerProfile.user_id == User.id)
        .where(PlayerProfile.id == req.opponent_id, User.market_id == reporter_user.market_id)
        .options(selectinload(PlayerProfile.user))
    )
    opponent_profile = (await session.execute(stmt_opp)).scalar_one_or_none()
    if not opponent_profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Opponent profile not found.",
        )

    if reporter_profile.id == opponent_profile.id:
        raise ValueError("You cannot report a match against yourself.")

    # 3. Verify division exists in user's market and both players are actively enrolled
    await _require_division_and_enrollment(
        session,
        req.division_id,
        reporter_user.market_id,
        reporter_user.id,
        opponent_profile.user_id,
    )

    # 4. Check rematch limits
    # Query prior head-to-head matches in this division
    h2h_stmt = select(Match).where(
        Match.division_id == req.division_id,
        Match.status == MatchStatus.CONFIRMED,
        Match.winner_id.in_([reporter_profile.id, opponent_profile.id]),
        Match.loser_id.in_([reporter_profile.id, opponent_profile.id]),
    )
    prior_matches = (await session.execute(h2h_stmt)).scalars().all()

    prior_wins = sum(1 for m in prior_matches if m.winner_id == reporter_profile.id)
    prior_losses = len(prior_matches) - prior_wins

    rematch_ok, rematch_err = check_rematch_eligibility(
        prior_wins_vs_opponent=prior_wins,
        prior_losses_vs_opponent=prior_losses,
        max_wins=settings.max_wins_vs_opponent,
        long_season_days=settings.long_season_days,
    )
    if not rematch_ok:
        raise ValueError(rematch_err)

    # 5. Format and outcome validation
    match_fmt = MatchFormat(req.format)
    outcome = OutcomeType(req.outcome_type)

    if outcome in (OutcomeType.NO_SHOW, OutcomeType.LATE_CANCEL):
        # Walkover: 0-0
        domain_sets = [DomainSetScore(winner=0, loser=0)]
        winner_id = reporter_profile.id if req.i_am_winner else opponent_profile.id
        loser_id = opponent_profile.id if req.i_am_winner else reporter_profile.id

        # Discipline checks
        if outcome == OutcomeType.NO_SHOW:
            waited = req.minutes_waited or 20
            strikes_to_propose, err = evaluate_no_show_strike(
                minutes_waited=waited,
                required_wait_minutes=settings.no_show_wait_minutes,
            )
            if err:
                raise ValueError(err)
            if strikes_to_propose > 0:
                strike = Strike(
                    market_id=reporter_user.market_id,
                    user_id=opponent_profile.user_id,
                    points=strikes_to_propose,
                    reason=f"No-show reported by {reporter_profile.display_name} (waited {waited} min)",
                    status=StrikeStatus.PROPOSED,
                    calendar_year=now_utc.year,
                )
                session.add(strike)

        elif outcome == OutcomeType.LATE_CANCEL:
            hours_before = req.hours_before_match if req.hours_before_match is not None else 2.0
            strikes_to_propose = evaluate_cancellation_strike(
                hours_before_match=hours_before,
                match_time_local=now_utc,
                is_rain_exempt=req.is_rain_exempt,
                late_cancel_hours_threshold=settings.late_cancel_hours,
            )
            if strikes_to_propose > 0:
                strike = Strike(
                    market_id=reporter_user.market_id,
                    user_id=opponent_profile.user_id,
                    points=strikes_to_propose,
                    reason=f"Late cancellation within {hours_before}h reported by {reporter_profile.display_name}",
                    status=StrikeStatus.PROPOSED,
                    calendar_year=now_utc.year,
                )
                session.add(strike)
    else:
        # Standard or retired match score validation
        domain_sets = [
            DomainSetScore(winner=s.winner, loser=s.loser, super_tiebreak=s.super_tiebreak)
            for s in req.sets
        ]
        errors = validate_result(domain_sets, match_fmt, outcome=outcome)
        if errors:
            raise ValueError(" ; ".join(errors))

        if req.i_am_winner:
            winner_id = reporter_profile.id
            loser_id = opponent_profile.id
        else:
            winner_id = opponent_profile.id
            loser_id = reporter_profile.id

    sets_payload = [
        {"winner": s.winner, "loser": s.loser, "super_tiebreak": s.super_tiebreak}
        for s in domain_sets
    ]

    # Walkover / auto-confirm rule or SUBMITTED
    match_status = (
        MatchStatus.CONFIRMED
        if outcome in (OutcomeType.NO_SHOW, OutcomeType.LATE_CANCEL)
        else MatchStatus.SUBMITTED
    )

    # Handicap validation if requested
    handicap_lead = None
    handicap_recipient_id = None
    if req.is_handicap:
        my_matches = await count_player_confirmed_matches(session, reporter_profile.id)
        opp_matches = await count_player_confirmed_matches(session, opponent_profile.id)
        my_rating = parse_rating(reporter_profile.rating)
        opp_rating = parse_rating(opponent_profile.rating)

        eligible, reason, headstart = evaluate_handicap_eligibility(
            player_a_id=reporter_profile.id,
            player_a_rating=my_rating,
            player_a_matches=my_matches,
            player_b_id=opponent_profile.id,
            player_b_rating=opp_rating,
            player_b_matches=opp_matches,
            min_qualifying_matches=settings.HANDICAP_MIN_MATCHES,
        )
        if not eligible or not headstart:
            raise ValueError(reason or "Handicap scoring requirements not met.")

        handicap_lead = headstart.lead
        handicap_recipient_id = headstart.lower_rated_player_id

    match = Match(
        market_id=reporter_user.market_id,
        division_id=req.division_id,
        winner_id=winner_id,
        loser_id=loser_id,
        format=req.format,
        outcome_type=req.outcome_type,
        sets_json=json.dumps(sets_payload),
        status=match_status,
        reporter_id=reporter_user.id,
        is_handicap=req.is_handicap,
        handicap_lead=handicap_lead,
        handicap_recipient_id=handicap_recipient_id,
        played_at=now_utc,
    )
    session.add(match)
    await session.flush()

    # Audit Log
    audit = AuditLog(
        market_id=reporter_user.market_id,
        entity_type="match",
        entity_id=match.id,
        actor_id=reporter_user.id,
        action="match_reported",
        reason=f"Reported score: {format_sets_summary(sets_payload, req.format)}"
        + (f" [Handicap: {handicap_lead}]" if req.is_handicap else ""),
        changes_json=json.dumps(
            {
                "status": match_status,
                "outcome": req.outcome_type,
                "is_handicap": req.is_handicap,
                "handicap_lead": handicap_lead,
                "handicap_recipient_id": handicap_recipient_id,
            }
        ),
    )
    session.add(audit)

    if match_status == MatchStatus.CONFIRMED:
        await recalculate_division_standings(session, req.division_id)

    # Attach dynamic player names and score summary for response
    winner_name = (
        reporter_profile.display_name if req.i_am_winner else opponent_profile.display_name
    )
    loser_name = opponent_profile.display_name if req.i_am_winner else reporter_profile.display_name
    sets_summary = format_sets_summary(sets_payload, req.format)

    await session.commit()
    return match, winner_name, loser_name, sets_summary


async def confirm_match(session: AsyncSession, user: User, match_id: str) -> Match:
    """Confirm a submitted match result."""
    res = await session.execute(select(Match).where(Match.id == match_id))
    match = res.scalar_one_or_none()

    if not match or match.market_id != user.market_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found.",
        )

    await _assert_is_counterparty(session, user, match)

    if match.status != MatchStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Match cannot be confirmed from status '{match.status}'.",
        )

    match.status = MatchStatus.CONFIRMED
    await session.flush()

    audit = AuditLog(
        market_id=match.market_id,
        entity_type="match",
        entity_id=match.id,
        actor_id=user.id,
        action="match_confirmed",
        reason="Opponent confirmed reported score",
        changes_json=json.dumps({"status": "confirmed"}),
    )
    session.add(audit)

    await recalculate_division_standings(session, match.division_id)
    await session.commit()
    return match


async def dispute_match(session: AsyncSession, user: User, match_id: str, reason: str) -> Match:
    """Dispute a reported score, starting a 24h cooling-off window."""
    res = await session.execute(select(Match).where(Match.id == match_id))
    match = res.scalar_one_or_none()

    if not match or match.market_id != user.market_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Match not found.",
        )

    await _assert_is_counterparty(session, user, match)

    if match.status != MatchStatus.SUBMITTED:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Match cannot be disputed from status '{match.status}'.",
        )

    match.status = MatchStatus.DISPUTED
    cooling_off = datetime.now(UTC) + timedelta(hours=settings.dispute_cooling_off_hours)

    dispute = MatchDispute(
        match_id=match.id,
        disputer_id=user.id,
        reason=reason,
        cooling_off_until=cooling_off,
        status=DisputeStatus.PENDING,
    )
    session.add(dispute)

    audit = AuditLog(
        market_id=match.market_id,
        entity_type="match",
        entity_id=match.id,
        actor_id=user.id,
        action="match_disputed",
        reason=reason,
        changes_json=json.dumps({"cooling_off_until": cooling_off.isoformat()}),
    )
    session.add(audit)

    await session.commit()
    return match


async def recalculate_division_standings(session: AsyncSession, division_id: str) -> None:
    """Recalculate standing rows for all players in a division using the pure domain engine."""
    # 1. Fetch confirmed matches in division
    matches_stmt = select(Match).where(
        Match.division_id == division_id,
        Match.status == MatchStatus.CONFIRMED,
    )
    matches = (await session.execute(matches_stmt)).scalars().all()

    # 2. Fetch division to inspect policy settings
    div_res = await session.execute(select(Division).where(Division.id == division_id))
    division = div_res.scalar_one_or_none()

    # 3. Fetch all actively enrolled players in this division
    players_stmt = (
        select(PlayerProfile)
        .join(Enrollment, Enrollment.user_id == PlayerProfile.user_id)
        .where(
            Enrollment.division_id == division_id,
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.PLACED_IN_DIVISION]),
        )
    )
    players = (await session.execute(players_stmt)).scalars().all()

    # 4. Aggregate records per player
    domain_rows: list[DomainStandingRow] = []

    for p in players:
        wins = 0
        losses = 0
        games_won = 0
        games_lost = 0
        opponents = set()

        for m in matches:
            sets = json.loads(m.sets_json)
            if m.winner_id == p.id:
                wins += 1
                opponents.add(m.loser_id)
                for s in sets:
                    games_won += s.get("winner", 0)
                    games_lost += s.get("loser", 0)
            elif m.loser_id == p.id:
                losses += 1
                opponents.add(m.winner_id)
                for s in sets:
                    games_won += s.get("loser", 0)
                    games_lost += s.get("winner", 0)

        domain_rows.append(
            DomainStandingRow(
                player_id=p.id,
                player_name=p.display_name,
                home_area=p.home_area,
                is_daytime=p.is_daytime,
                wins=wins,
                losses=losses,
                games_won=games_won,
                games_lost=games_lost,
                distinct_opponents=len(opponents),
                is_new_player=(p.veteran_match_count == 0),
            )
        )

    # 5. Run pure domain engine using division's rules if configured, falling back to global settings
    playoff_min_wins = (
        division.playoff_min_wins
        if division and division.playoff_min_wins is not None
        else settings.playoff_min_wins
    )
    new_player_min_matches = (
        division.new_player_min_matches
        if division and division.new_player_min_matches is not None
        else settings.new_player_min_matches
    )
    rules = DivisionRules(
        playoff_min_wins=playoff_min_wins,
        new_player_min_matches=new_player_min_matches,
    )
    ranked = compute_standings(domain_rows, rules=rules)

    # 6. Delete stale standing rows for players no longer actively enrolled
    ranked_player_ids = {r.player_id for r in ranked}
    existing_rows_stmt = select(StandingRowModel).where(StandingRowModel.division_id == division_id)
    existing_rows = (await session.execute(existing_rows_stmt)).scalars().all()
    for row in existing_rows:
        if row.player_id not in ranked_player_ids:
            await session.delete(row)

    # 7. Persist updated rows to standing_rows table
    for r in ranked:
        row_stmt = select(StandingRowModel).where(
            StandingRowModel.division_id == division_id,
            StandingRowModel.player_id == r.player_id,
        )
        existing = (await session.execute(row_stmt)).scalar_one_or_none()
        if not existing:
            existing = StandingRowModel(
                division_id=division_id,
                player_id=r.player_id,
            )
            session.add(existing)

        existing.rank = r.rank
        existing.wins = r.wins
        existing.losses = r.losses
        existing.games_won = r.games_won
        existing.games_lost = r.games_lost
        existing.distinct_opponents = r.distinct_opponents
        existing.is_playoff_eligible = r.is_playoff_eligible
        existing.playoff_indicator = r.playoff_indicator

    # 8. Record audit log for standings recalculation
    session.add(
        AuditLog(
            market_id=division.market_id if division else settings.DEFAULT_MARKET_ID,
            entity_type="division",
            entity_id=division_id,
            actor_id="system",
            action="standings.recalculate",
            reason=f"Recalculated standings for division {division_id}",
        )
    )

    await session.flush()


async def get_division_roster(
    session: AsyncSession, division_id: str, requesting_user: User
) -> list[RosterPlayerResponse]:
    """Return opponent contacts only to paid, active enrollees in this division (Contact Gating Rule)."""
    # 1. Verify requesting user is actively enrolled in division
    enr_check = select(Enrollment).where(
        Enrollment.division_id == division_id,
        Enrollment.user_id == requesting_user.id,
        Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.PLACED_IN_DIVISION]),
    )
    user_enr = (await session.execute(enr_check)).scalar_one_or_none()

    if not user_enr and requesting_user.role != "super_admin":
        raise PermissionError(
            "Contact details are only accessible to active, paid players in this division."
        )

    # 2. Query roster players
    roster_stmt = (
        select(PlayerProfile, User)
        .join(User, User.id == PlayerProfile.user_id)
        .join(Enrollment, Enrollment.user_id == User.id)
        .where(
            Enrollment.division_id == division_id,
            Enrollment.status.in_([EnrollmentStatus.ACTIVE, EnrollmentStatus.PLACED_IN_DIVISION]),
        )
    )
    results = (await session.execute(roster_stmt)).all()

    roster = []
    for profile, u in results:
        roster.append(
            RosterPlayerResponse(
                player_id=profile.id,
                display_name=profile.display_name,
                phone=profile.phone if not profile.is_anonymized else "",
                email=u.email if not profile.is_anonymized else "",
                rating=profile.rating,
                home_area=profile.home_area,
                is_daytime=profile.is_daytime,
                gender=profile.gender,
                birth_year=profile.birth_year,
                favorite_link=profile.favorite_link if not profile.is_anonymized else None,
                game_description=profile.game_description if not profile.is_anonymized else None,
                about_me=profile.about_me if not profile.is_anonymized else None,
            )
        )
    return roster


async def get_latest_scores_feed(
    session: AsyncSession, market_id: str | None = None, limit: int = 20
) -> list[LatestScoreFeedItem]:
    """Retrieve market-wide latest verified match results feed without N+1 queries."""
    target_market_id = market_id or settings.DEFAULT_MARKET_ID
    stmt = (
        select(Match)
        .where(Match.status == MatchStatus.CONFIRMED, Match.market_id == target_market_id)
        .order_by(Match.played_at.desc())
        .limit(limit)
    )
    matches = (await session.execute(stmt)).scalars().all()
    if not matches:
        return []

    # Bulk load player names and division names to avoid N+1 queries
    player_ids = {m.winner_id for m in matches} | {m.loser_id for m in matches}
    division_ids = {m.division_id for m in matches}

    prof_stmt = select(PlayerProfile).where(PlayerProfile.id.in_(player_ids))
    profs = (await session.execute(prof_stmt)).scalars().all()
    prof_map = {p.id: p.display_name for p in profs}

    div_stmt = select(Division).where(Division.id.in_(division_ids))
    divs = (await session.execute(div_stmt)).scalars().all()
    div_map = {d.id: d.name for d in divs}

    feed_items = []
    for m in matches:
        winner_name = prof_map.get(m.winner_id, "Winner")
        loser_name = prof_map.get(m.loser_id, "Opponent")
        div_name = div_map.get(m.division_id, "Competitive Division")

        sets = json.loads(m.sets_json)
        score_line = format_sets_summary(sets, m.format)
        if m.outcome_type == "retired":
            score_line += " (Ret.)"
        elif m.outcome_type in ("no_show", "late_cancel"):
            score_line = f"Walkover ({m.outcome_type.replace('_', ' ')})"

        date_str = m.played_at.strftime("%m/%d/%y")

        feed_items.append(
            LatestScoreFeedItem(
                id=m.id,
                winner_name=winner_name,
                loser_name=loser_name,
                score_line=score_line,
                division_name=div_name,
                date_str=date_str,
                is_handicap=m.is_handicap,
                handicap_lead=m.handicap_lead,
            )
        )
    return feed_items
