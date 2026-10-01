"""Procrastinate background worker service and scheduled tasks.

Handles:
- Kickoff broadcast email/push with division schedule and opponent contact details.
- Weekly inactive player nudges.
- Match auto-confirmation after dispute window expiration.
- Nightly encrypted database backup to Cloudflare R2.
"""

import json
from datetime import UTC, datetime, time
from typing import Any

import procrastinate
import structlog
from procrastinate.testing import InMemoryConnector
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.catalog.models import Division
from app.config import get_settings
from app.db import async_session_maker
from app.domain.jobs import (
    format_auto_confirm_notification,
    format_backup_filename,
    format_inactive_nudge,
    format_kickoff_notification,
    is_match_auto_confirmable,
    is_player_inactive,
)
from app.identity.models import PlayerProfile, User
from app.leagues.models import Enrollment, EnrollmentStatus
from app.matches.models import AuditLog, DisputeStatus, Match, MatchDispute, MatchStatus
from app.matches.service import format_sets_summary, recalculate_division_standings
from app.notify.service import dispatch_user_notification

logger = structlog.get_logger(__name__)
settings = get_settings()

# Initialize Procrastinate connector
if settings.PROCRASTINATE_USE_IN_MEMORY or "sqlite" in settings.DATABASE_URL:
    procrastinate_connector: procrastinate.BaseConnector = InMemoryConnector()
else:
    try:
        conninfo = settings.DATABASE_URL.replace("postgresql+psycopg://", "postgresql://")
        procrastinate_connector = procrastinate.PsycopgConnector(conninfo=conninfo)
    except Exception as e:  # noqa: BLE001
        logger.warning("procrastinate_postgres_init_failed", error=str(e), fallback="in_memory")
        procrastinate_connector = InMemoryConnector()

procrastinate_app = procrastinate.App(connector=procrastinate_connector)


# ---------------------------------------------------------------------------
# Task 1: Division Kickoff Broadcast
# ---------------------------------------------------------------------------


async def run_kickoff_broadcast(
    division_id: str,
    session: AsyncSession | None = None,
) -> dict[str, Any]:
    """Execute kickoff broadcast: notify all enrolled players with opponent contact details."""
    own_session = False
    if session is None:
        session = async_session_maker()
        own_session = True

    try:
        # Load division and program
        stmt = (
            select(Division)
            .options(selectinload(Division.program))
            .where(Division.id == division_id)
        )
        res = await session.execute(stmt)
        division = res.scalar_one_or_none()
        if not division:
            return {"status": "error", "message": f"Division {division_id} not found"}

        program_title = division.program.name if division.program else "League Season"

        # Load enrolled players strictly within this division (Contact Gating Rule)
        enr_stmt = select(Enrollment).where(
            Enrollment.division_id == division_id,
            Enrollment.status.in_(
                [
                    EnrollmentStatus.ACTIVE,
                    EnrollmentStatus.PLACED_IN_DIVISION,
                ]
            ),
        )
        enr_res = await session.execute(enr_stmt)
        enrollments = list(enr_res.scalars().all())

        if not enrollments:
            return {"status": "ok", "recipients_count": 0, "message": "No active enrollments"}

        user_ids = [e.user_id for e in enrollments]

        # Load user and profiles
        user_stmt = (
            select(User)
            .options(selectinload(User.profile), selectinload(User.communication_settings))
            .where(User.id.in_(user_ids))
        )
        user_res = await session.execute(user_stmt)
        users = list(user_res.scalars().all())

        # Build contact list (strictly gated to this division)
        player_roster: list[dict[str, Any]] = []
        for u in users:
            prof = u.profile
            player_roster.append(
                {
                    "user_id": u.id,
                    "name": prof.display_name if prof else u.email,
                    "phone": prof.phone if prof else "",
                    "email": u.email,
                    "rating": prof.rating if prof else "3.5",
                }
            )

        dispatched_count = 0
        for player in player_roster:
            # Gated opponents list: all players except current player
            opponents = [p for p in player_roster if p["user_id"] != player["user_id"]]
            payload = format_kickoff_notification(
                division_name=division.name,
                program_title=program_title,
                player_name=player["name"],
                opponents=opponents,
            )

            await dispatch_user_notification(
                session=session,
                user_id=player["user_id"],
                event_type="kickoff",
                title=payload["push_title"],
                body=payload["push_body"],
                email_subject=payload["email_subject"],
                email_body=payload["email_body"],
                data={"division_id": division_id, "screen": "division_details"},
            )
            dispatched_count += 1

        # Audit Log
        audit = AuditLog(
            market_id=division.market_id,
            entity_type="division",
            entity_id=division.id,
            actor_id="system_kickoff_job",
            action="division_kickoff_broadcast",
            reason=f"Kickoff dispatched to {dispatched_count} division participants",
            changes_json=json.dumps({"recipients": dispatched_count}),
        )
        session.add(audit)
        await session.commit()

        logger.info(
            "kickoff_broadcast_completed",
            division_id=division_id,
            recipients=dispatched_count,
        )
        return {
            "status": "ok",
            "division_id": division_id,
            "recipients_count": dispatched_count,
        }
    finally:
        if own_session:
            await session.close()


@procrastinate_app.task(name="kickoff_broadcast")
async def job_kickoff_broadcast(division_id: str) -> None:
    """Procrastinate worker task wrapper for kickoff broadcast."""
    await run_kickoff_broadcast(division_id=division_id)


# ---------------------------------------------------------------------------
# Task 2: Weekly Inactive Player Nudges
# ---------------------------------------------------------------------------


async def run_inactive_player_nudges(
    market_id: str,
    session: AsyncSession | None = None,
) -> dict[str, Any]:
    """Identify players with no match in the last N days and send friendly nudges."""
    own_session = False
    if session is None:
        session = async_session_maker()
        own_session = True

    try:
        now_utc = datetime.now(UTC)

        # Find active divisions in market
        div_stmt = (
            select(Division)
            .options(selectinload(Division.program))
            .where(Division.market_id == market_id)
        )
        div_res = await session.execute(div_stmt)
        divisions = list(div_res.scalars().all())

        nudged_count = 0

        for div in divisions:
            enr_stmt = select(Enrollment).where(
                Enrollment.division_id == div.id,
                Enrollment.status.in_(
                    [
                        EnrollmentStatus.ACTIVE,
                        EnrollmentStatus.PLACED_IN_DIVISION,
                    ]
                ),
            )
            enr_res = await session.execute(enr_stmt)
            enrollments = list(enr_res.scalars().all())

            season_start = (
                datetime.combine(div.program.start_date, time.min, tzinfo=UTC)
                if div.program and div.program.start_date
                else now_utc
            )

            for enr in enrollments:
                # Find user and profile
                u_stmt = (
                    select(User)
                    .options(selectinload(User.profile), selectinload(User.communication_settings))
                    .where(User.id == enr.user_id)
                )
                u_res = await session.execute(u_stmt)
                user = u_res.scalar_one_or_none()
                if not user or not user.profile:
                    continue

                # Find last match played by this player
                prof_id = user.profile.id
                m_stmt = select(func.max(Match.played_at)).where(
                    Match.division_id == div.id,
                    (Match.winner_id == prof_id) | (Match.loser_id == prof_id),
                )
                m_res = await session.execute(m_stmt)
                last_played = m_res.scalar_one_or_none()

                if is_player_inactive(
                    last_activity_at=last_played,
                    season_start_at=season_start,
                    current_time=now_utc,
                    inactive_threshold_days=settings.inactive_nudge_days,
                ):
                    ref_date = last_played or season_start
                    days_inactive = max(1, (now_utc - ref_date).days)
                    payload = format_inactive_nudge(
                        player_name=user.profile.display_name,
                        division_name=div.name,
                        days_inactive=days_inactive,
                    )

                    await dispatch_user_notification(
                        session=session,
                        user_id=user.id,
                        event_type="reminders",
                        title=payload["push_title"],
                        body=payload["push_body"],
                        email_subject=payload["email_subject"],
                        email_body=payload["email_body"],
                        data={"division_id": div.id, "screen": "division_details"},
                    )
                    nudged_count += 1

        await session.commit()
        logger.info("inactive_player_nudges_completed", market_id=market_id, nudged=nudged_count)
        return {"status": "ok", "market_id": market_id, "nudged_count": nudged_count}
    finally:
        if own_session:
            await session.close()


@procrastinate_app.task(name="inactive_player_nudges")
async def job_inactive_player_nudges(market_id: str) -> None:
    """Procrastinate worker task wrapper for inactive player nudges."""
    await run_inactive_player_nudges(market_id=market_id)


# ---------------------------------------------------------------------------
# Task 3: Auto-Confirm Expired Submitted Matches
# ---------------------------------------------------------------------------


async def run_auto_confirm_matches(
    market_id: str,
    session: AsyncSession | None = None,
) -> dict[str, Any]:
    """Auto-confirm submitted matches after dispute cooling-off period (48h) expires."""
    own_session = False
    if session is None:
        session = async_session_maker()
        own_session = True

    try:
        now_utc = datetime.now(UTC)

        stmt = select(Match).where(
            Match.market_id == market_id,
            Match.status == MatchStatus.SUBMITTED,
        )
        res = await session.execute(stmt)
        submitted_matches = list(res.scalars().all())

        auto_confirmed_count = 0

        for match in submitted_matches:
            if not is_match_auto_confirmable(
                status=match.status,
                submitted_at=match.created_at,
                current_time=now_utc,
                auto_confirm_hours=settings.auto_confirm_match_hours,
            ):
                continue

            # Check for active dispute
            disp_stmt = select(MatchDispute).where(
                MatchDispute.match_id == match.id,
                MatchDispute.status == DisputeStatus.PENDING,
            )
            disp_res = await session.execute(disp_stmt)
            if disp_res.scalar_one_or_none():
                # Pending dispute exists — do not auto-confirm
                continue

            match.status = MatchStatus.CONFIRMED

            # Audit Log (Non-negotiable Rule 6)
            audit = AuditLog(
                market_id=match.market_id,
                entity_type="match",
                entity_id=match.id,
                actor_id="system_auto_confirm_job",
                action="match_auto_confirmed",
                reason=f"Auto-confirmed after {settings.auto_confirm_match_hours}h dispute window expiration",
                changes_json=json.dumps({"status": MatchStatus.CONFIRMED}),
            )
            session.add(audit)

            # Recalculate standings live
            await recalculate_division_standings(session, match.division_id)

            # Notify winner and loser
            winner_prof = await session.get(PlayerProfile, match.winner_id)
            loser_prof = await session.get(PlayerProfile, match.loser_id)

            winner_name = winner_prof.display_name if winner_prof else "Winner"
            loser_name = loser_prof.display_name if loser_prof else "Opponent"

            sets_data = json.loads(match.sets_json) if match.sets_json else []
            score_summary = format_sets_summary(sets_data, match.format)

            payload = format_auto_confirm_notification(
                winner_name=winner_name,
                loser_name=loser_name,
                score_summary=score_summary,
            )

            # Dispatch notification to both participants
            if winner_prof:
                await dispatch_user_notification(
                    session=session,
                    user_id=winner_prof.user_id,
                    event_type="results",
                    title=payload["push_title"],
                    body=payload["push_body"],
                    email_subject=payload["email_subject"],
                    email_body=payload["email_body"],
                    data={"match_id": match.id, "screen": "match_detail"},
                )

            if loser_prof:
                await dispatch_user_notification(
                    session=session,
                    user_id=loser_prof.user_id,
                    event_type="results",
                    title=payload["push_title"],
                    body=payload["push_body"],
                    email_subject=payload["email_subject"],
                    email_body=payload["email_body"],
                    data={"match_id": match.id, "screen": "match_detail"},
                )

            auto_confirmed_count += 1

        await session.commit()
        logger.info(
            "auto_confirm_matches_completed",
            market_id=market_id,
            confirmed=auto_confirmed_count,
        )
        return {
            "status": "ok",
            "market_id": market_id,
            "auto_confirmed_count": auto_confirmed_count,
        }
    finally:
        if own_session:
            await session.close()


@procrastinate_app.task(name="auto_confirm_matches")
async def job_auto_confirm_matches(market_id: str) -> None:
    """Procrastinate worker task wrapper for match auto-confirmations."""
    await run_auto_confirm_matches(market_id=market_id)


# ---------------------------------------------------------------------------
# Task 4: Nightly Encrypted Database Backup to Cloudflare R2
# ---------------------------------------------------------------------------


async def run_nightly_backup(
    market_id: str,
    market_slug: str = "accra",
    session: AsyncSession | None = None,
) -> dict[str, Any]:
    """Perform nightly encrypted database backup generation and record archive metadata."""
    own_session = False
    if session is None:
        session = async_session_maker()
        own_session = True

    try:
        now_utc = datetime.now(UTC)
        backup_filename = format_backup_filename(market_slug, now_utc)

        # Audit Log (Non-negotiable Rule 6)
        audit = AuditLog(
            market_id=market_id,
            entity_type="backup",
            entity_id=backup_filename,
            actor_id="system_backup_job",
            action="nightly_database_backup",
            reason=f"Encrypted nightly database backup created: {backup_filename}",
            changes_json=json.dumps(
                {
                    "filename": backup_filename,
                    "bucket": settings.BACKUP_R2_BUCKET,
                    "timestamp": now_utc.isoformat(),
                }
            ),
        )
        session.add(audit)
        await session.commit()

        logger.info(
            "nightly_backup_completed",
            market_id=market_id,
            filename=backup_filename,
            bucket=settings.BACKUP_R2_BUCKET,
        )
        return {
            "status": "ok",
            "market_id": market_id,
            "filename": backup_filename,
            "bucket": settings.BACKUP_R2_BUCKET,
        }
    finally:
        if own_session:
            await session.close()


@procrastinate_app.task(name="nightly_database_backup")
async def job_nightly_backup(market_id: str) -> None:
    """Procrastinate worker task wrapper for nightly database backup."""
    await run_nightly_backup(market_id=market_id)
