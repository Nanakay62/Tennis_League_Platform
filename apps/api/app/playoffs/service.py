"""Playoffs service: draw generation, bracket persistence, match progression, and round queries."""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.catalog.models import Division
from app.config import get_settings
from app.domain.brackets import (
    BracketPlayer,
    build_single_elimination_draw,
)
from app.identity.models import PlayerProfile
from app.leagues.models import StandingRowModel
from app.playoffs.models import BracketStatus, BracketType, PlayoffBracket, PlayoffMatch
from app.playoffs.schemas import (
    PlayoffBracketResponse,
    PlayoffMatchResponse,
    PlayoffPlayerSummary,
)

settings = get_settings()


async def generate_division_playoffs(
    session: AsyncSession,
    division_id: str,
    min_wins: int = 5,
    enable_veteran_seeding: bool = True,
) -> PlayoffBracketResponse:
    """Generate and persist a single-elimination championship playoff draw from division standings."""
    # Check division exists
    div_res = await session.execute(select(Division).where(Division.id == division_id))
    division = div_res.scalar_one_or_none()
    if not division:
        raise ValueError(f"Division '{division_id}' not found.")

    # Remove any existing championship bracket for clean regeneration
    existing_brackets = await session.execute(
        select(PlayoffBracket).where(
            PlayoffBracket.division_id == division_id,
            PlayoffBracket.bracket_type == BracketType.CHAMPIONSHIP,
        )
    )
    for b in existing_brackets.scalars().all():
        await session.delete(b)
    await session.flush()

    # Load standing rows
    rows_res = await session.execute(
        select(StandingRowModel)
        .where(StandingRowModel.division_id == division_id)
        .order_by(StandingRowModel.rank.asc())
    )
    standing_rows = rows_res.scalars().all()

    # Filter qualified players
    qualified = [r for r in standing_rows if r.wins >= min_wins]
    if len(qualified) < 2:
        raise ValueError(
            f"Not enough qualified players for playoffs in division '{division_id}'. "
            f"Required at least 2 players with {min_wins}+ wins, but found {len(qualified)}."
        )

    # Fetch player profiles for qualified players
    q_ids = [q.player_id for q in qualified]
    prof_res = await session.execute(select(PlayerProfile).where(PlayerProfile.id.in_(q_ids)))
    names_map = {p.id: p.display_name for p in prof_res.scalars().all()}

    # Convert to pure domain BracketPlayer
    domain_players = [
        BracketPlayer(
            player_id=q.player_id,
            display_name=names_map.get(q.player_id, f"Player {q.rank}"),
            standings_rank=q.rank,
            regular_season_wins=q.wins,
            career_matches_played=q.wins + q.losses,
        )
        for q in qualified
    ]

    # Generate draw via pure domain engine
    domain_draw = build_single_elimination_draw(
        domain_players, enable_veteran_seeding=enable_veteran_seeding
    )

    # Create bracket record
    bracket = PlayoffBracket(
        division_id=division_id,
        bracket_type=BracketType.CHAMPIONSHIP,
        bracket_size=domain_draw.bracket_size,
        total_rounds=domain_draw.total_rounds,
        status=BracketStatus.ACTIVE,
    )
    session.add(bracket)
    await session.flush()

    # Map of domain draw match id (e.g. "R1M1") to db PlayoffMatch entity
    db_matches: dict[str, PlayoffMatch] = {}
    base_deadline = datetime.now(UTC)

    # Instantiate db matches in order
    for r_num in range(1, domain_draw.total_rounds + 1):
        round_matches = domain_draw.rounds[r_num]
        round_deadline = base_deadline + timedelta(days=settings.round_deadline_days * r_num)
        for dm in round_matches:
            db_match = PlayoffMatch(
                bracket_id=bracket.id,
                round_number=dm.round_number,
                match_number=dm.match_number,
                player1_id=dm.player1.player_id if dm.player1 else None,
                player2_id=dm.player2.player_id if dm.player2 else None,
                winner_id=dm.winner.player_id if dm.winner else None,
                score_summary="Bye" if dm.is_bye else None,
                is_bye=dm.is_bye,
                deadline=round_deadline,
            )
            session.add(db_match)
            db_matches[dm.id] = db_match

    await session.flush()

    # Link next_match_id references
    for r_num in range(1, domain_draw.total_rounds):
        round_matches = domain_draw.rounds[r_num]
        for dm in round_matches:
            if dm.next_match_id and dm.next_match_id in db_matches:
                db_matches[dm.id].next_match_id = db_matches[dm.next_match_id].id

    # If any match was a bye, propagate winner to round 2 db match
    for dm in domain_draw.rounds[1]:
        if dm.is_bye and dm.winner and dm.next_match_id:
            parent_db = db_matches[dm.next_match_id]
            if dm.match_number % 2 == 1:
                parent_db.player1_id = dm.winner.player_id
            else:
                parent_db.player2_id = dm.winner.player_id

    await session.commit()
    return await get_bracket_response(session, bracket.id)


async def get_bracket_response(session: AsyncSession, bracket_id: str) -> PlayoffBracketResponse:
    """Load and format a playoff bracket tree response."""
    bracket_stmt = (
        select(PlayoffBracket)
        .where(PlayoffBracket.id == bracket_id)
        .options(selectinload(PlayoffBracket.matches))
    )
    res = await session.execute(bracket_stmt)
    bracket = res.scalar_one_or_none()
    if not bracket:
        raise ValueError(f"Playoff bracket '{bracket_id}' not found.")

    # Gather all player IDs
    player_ids: set[str] = set()
    for m in bracket.matches:
        if m.player1_id:
            player_ids.add(m.player1_id)
        if m.player2_id:
            player_ids.add(m.player2_id)
        if m.winner_id:
            player_ids.add(m.winner_id)

    name_map: dict[str, str] = {}
    if player_ids:
        profiles_res = await session.execute(
            select(PlayerProfile).where(PlayerProfile.id.in_(player_ids))
        )
        for prof in profiles_res.scalars().all():
            name_map[prof.id] = prof.display_name

    # Group matches by round
    rounds_dict: dict[str, list[PlayoffMatchResponse]] = {
        str(r): [] for r in range(1, bracket.total_rounds + 1)
    }

    for m in sorted(bracket.matches, key=lambda x: (x.round_number, x.match_number)):
        p1 = (
            PlayoffPlayerSummary(
                id=m.player1_id, display_name=name_map.get(m.player1_id, "Player 1")
            )
            if m.player1_id
            else None
        )
        p2 = (
            PlayoffPlayerSummary(
                id=m.player2_id, display_name=name_map.get(m.player2_id, "Player 2")
            )
            if m.player2_id
            else None
        )
        winner = (
            PlayoffPlayerSummary(id=m.winner_id, display_name=name_map.get(m.winner_id, "Winner"))
            if m.winner_id
            else None
        )

        match_resp = PlayoffMatchResponse(
            id=m.id,
            round_number=m.round_number,
            match_number=m.match_number,
            player1=p1,
            player2=p2,
            winner=winner,
            score_summary=m.score_summary,
            is_bye=m.is_bye,
            deadline=m.deadline.isoformat() if m.deadline else None,
            next_match_id=m.next_match_id,
        )
        rounds_dict[str(m.round_number)].append(match_resp)

    return PlayoffBracketResponse(
        id=bracket.id,
        division_id=bracket.division_id,
        bracket_type=bracket.bracket_type,
        bracket_size=bracket.bracket_size,
        total_rounds=bracket.total_rounds,
        status=bracket.status,
        rounds=rounds_dict,
    )


async def get_division_playoff_brackets(
    session: AsyncSession, division_id: str
) -> list[PlayoffBracketResponse]:
    """Retrieve all active playoff brackets (championship and consolation) for a division."""
    res = await session.execute(
        select(PlayoffBracket.id)
        .where(PlayoffBracket.division_id == division_id)
        .order_by(PlayoffBracket.created_at.asc())
    )
    bracket_ids = res.scalars().all()
    results: list[PlayoffBracketResponse] = []
    for b_id in bracket_ids:
        results.append(await get_bracket_response(session, b_id))
    return results


async def report_playoff_match_score(
    session: AsyncSession,
    match_id: str,
    winner_id: str,
    score_summary: str,
) -> PlayoffMatchResponse:
    """Record a playoff match score and advance the winner into the next round."""
    res = await session.execute(select(PlayoffMatch).where(PlayoffMatch.id == match_id))
    match = res.scalar_one_or_none()
    if not match:
        raise ValueError(f"Playoff match '{match_id}' not found.")

    if winner_id not in (match.player1_id, match.player2_id):
        raise ValueError("Declared winner must be one of the match participants.")

    match.winner_id = winner_id
    match.score_summary = score_summary

    # Advance winner into next match if exists
    if match.next_match_id:
        next_res = await session.execute(
            select(PlayoffMatch).where(PlayoffMatch.id == match.next_match_id)
        )
        next_match = next_res.scalar_one_or_none()
        if next_match:
            if match.match_number % 2 == 1:
                next_match.player1_id = winner_id
            else:
                next_match.player2_id = winner_id

    # Check if this was the final round
    bracket_res = await session.execute(
        select(PlayoffBracket).where(PlayoffBracket.id == match.bracket_id)
    )
    bracket = bracket_res.scalar_one_or_none()
    if bracket and match.round_number == bracket.total_rounds:
        bracket.status = BracketStatus.COMPLETED

    await session.commit()

    # Format single match response
    prof_res = await session.execute(select(PlayerProfile).where(PlayerProfile.id == winner_id))
    prof = prof_res.scalar_one_or_none()
    winner_name = prof.display_name if prof else "Winner"

    return PlayoffMatchResponse(
        id=match.id,
        round_number=match.round_number,
        match_number=match.match_number,
        player1=PlayoffPlayerSummary(id=match.player1_id, display_name="")
        if match.player1_id
        else None,
        player2=PlayoffPlayerSummary(id=match.player2_id, display_name="")
        if match.player2_id
        else None,
        winner=PlayoffPlayerSummary(id=winner_id, display_name=winner_name),
        score_summary=match.score_summary,
        is_bye=match.is_bye,
        deadline=match.deadline.isoformat() if match.deadline else None,
        next_match_id=match.next_match_id,
    )
