"""Integration tests for admin back office actions, role-based gating, and immutable audit logs."""

import json
from datetime import UTC, date, datetime

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division, Program, ProgramStatus, ProgramType
from app.identity.models import PlayerProfile, User, UserRole
from app.leagues.models import Enrollment, EnrollmentStatus
from app.markets.models import Market
from app.matches.models import (
    AuditLog,
    DisputeStatus,
    Match,
    MatchDispute,
    MatchStatus,
    Strike,
    StrikeStatus,
)


async def _create_test_environment(db_session: AsyncSession) -> tuple[str, str, str, str]:
    market = Market(
        name="Frankfurt am Main",
        slug="frankfurt",
        timezone="Europe/Berlin",
        currency="EUR",
        is_active=True,
    )
    db_session.add(market)
    await db_session.flush()

    program = Program(
        market_id=market.id,
        name="Frankfurt Fall 2026",
        slug="frankfurt-fall-2026",
        program_type=ProgramType.FLEX_SEASON,
        start_date=date(2026, 10, 1),
        end_date=date(2026, 11, 30),
        price_cents=3495,
        currency="EUR",
        status=ProgramStatus.OPEN,
    )
    db_session.add(program)
    await db_session.flush()

    div_a = Division(
        market_id=market.id,
        program_id=program.id,
        name="Competitive A",
        rating_band="3.5",
        playoff_min_wins=4,
        new_player_min_matches=5,
        is_active=True,
    )
    div_b = Division(
        market_id=market.id,
        program_id=program.id,
        name="Competitive B",
        rating_band="3.5",
        playoff_min_wins=4,
        new_player_min_matches=5,
        is_active=True,
    )
    db_session.add_all([div_a, div_b])
    await db_session.commit()
    return market.id, program.id, div_a.id, div_b.id


@pytest.mark.asyncio
async def test_admin_role_gating(client: AsyncClient, db_session: AsyncSession):
    _market_id, _program_id, div_a_id, _ = await _create_test_environment(db_session)

    # 1. Register regular player
    p_res = await client.post(
        "/auth/register",
        json={
            "email": "regular_player@example.com",
            "password": "Password123!",
            "display_name": "Regular Player",
        },
    )
    assert p_res.status_code == 201
    player_token = p_res.json()["access_token"]
    player_headers = {"Authorization": f"Bearer {player_token}"}

    # 2. Regular player attempting admin endpoint -> 403 Forbidden
    unauth_action = await client.post(
        "/admin/bulk-placement",
        json={"division_id": div_a_id, "user_ids": ["some-user-id"]},
        headers=player_headers,
    )
    assert unauth_action.status_code == 403
    assert "Administrative access required" in unauth_action.json()["detail"]

    # 3. Unauthenticated request -> 401
    anon_action = await client.post(
        "/admin/bulk-placement",
        json={"division_id": div_a_id, "user_ids": ["some-user-id"]},
    )
    assert anon_action.status_code == 401

    # 4. Register admin user and promote role
    admin_res = await client.post(
        "/auth/register",
        json={
            "email": "admin_user@example.com",
            "password": "Password123!",
            "display_name": "Admin User",
        },
    )
    assert admin_res.status_code == 201
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    # Elevate role in DB
    user = (
        await db_session.execute(select(User).where(User.email == "admin_user@example.com"))
    ).scalar_one()
    user.role = UserRole.MARKET_ADMIN
    await db_session.commit()
    admin_id = user.id

    # 5. Market Admin performing action -> 200 OK
    auth_action = await client.post(
        "/admin/bulk-placement",
        json={"division_id": div_a_id, "user_ids": [admin_id]},
        headers=admin_headers,
    )
    assert auth_action.status_code == 200
    assert auth_action.json()["status"] == "ok"


@pytest.mark.asyncio
async def test_bulk_placement_and_audit_trail(client: AsyncClient, db_session: AsyncSession):
    _market_id, _program_id, div_a_id, _ = await _create_test_environment(db_session)

    # Register admin
    admin_res = await client.post(
        "/auth/register",
        json={
            "email": "placement_admin@example.com",
            "password": "Password123!",
            "display_name": "Admin",
        },
    )
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_user = (
        await db_session.execute(select(User).where(User.email == "placement_admin@example.com"))
    ).scalar_one()
    admin_user.role = UserRole.SUPER_ADMIN
    await db_session.commit()
    admin_id = admin_user.id

    # Register 2 players
    p1 = await client.post(
        "/auth/register",
        json={
            "email": "player_one@example.com",
            "password": "Password123!",
            "display_name": "Player 1",
        },
    )
    assert p1.status_code == 201
    p2 = await client.post(
        "/auth/register",
        json={
            "email": "player_two@example.com",
            "password": "Password123!",
            "display_name": "Player 2",
        },
    )
    assert p2.status_code == 201

    p1_user = (
        await db_session.execute(select(User).where(User.email == "player_one@example.com"))
    ).scalar_one()
    p2_user = (
        await db_session.execute(select(User).where(User.email == "player_two@example.com"))
    ).scalar_one()
    p1_id, p2_id = p1_user.id, p2_user.id

    # Bulk placement request
    resp = await client.post(
        "/admin/bulk-placement",
        json={"division_id": div_a_id, "user_ids": [p1_id, p2_id]},
        headers=admin_headers,
    )
    assert resp.status_code == 200
    assert "Successfully placed 2 players" in resp.json()["message"]

    # Verify enrollments in DB
    enr_stmt = select(Enrollment).where(Enrollment.division_id == div_a_id)
    enr_res = await db_session.execute(enr_stmt)
    enrollments = enr_res.scalars().all()
    assert len(enrollments) == 2
    assert all(e.status == EnrollmentStatus.PLACED_IN_DIVISION for e in enrollments)

    # Verify AuditLog rows created (Rule 6)
    audit_stmt = select(AuditLog).where(AuditLog.actor_id == admin_id)
    audit_res = await db_session.execute(audit_stmt)
    logs = audit_res.scalars().all()
    assert len(logs) == 2
    assert all(l.action == "player_placed_in_division" for l in logs)


@pytest.mark.asyncio
async def test_player_transfer_between_divisions(client: AsyncClient, db_session: AsyncSession):
    market_id, program_id, div_a_id, div_b_id = await _create_test_environment(db_session)

    # Admin setup
    admin_res = await client.post(
        "/auth/register",
        json={
            "email": "transfer_admin@example.com",
            "password": "Password123!",
            "display_name": "Admin",
        },
    )
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_user = (
        await db_session.execute(select(User).where(User.email == "transfer_admin@example.com"))
    ).scalar_one()
    admin_user.role = UserRole.MARKET_ADMIN
    await db_session.commit()
    admin_id = admin_user.id

    # Register player and enroll in div_a
    p = await client.post(
        "/auth/register",
        json={
            "email": "transfer_target@example.com",
            "password": "Password123!",
            "display_name": "Target",
        },
    )
    assert p.status_code == 201

    target_user = (
        await db_session.execute(select(User).where(User.email == "transfer_target@example.com"))
    ).scalar_one()
    target_id = target_user.id

    enr = Enrollment(
        market_id=market_id,
        program_id=program_id,
        division_id=div_a_id,
        user_id=target_id,
        status=EnrollmentStatus.PLACED_IN_DIVISION,
    )
    db_session.add(enr)
    await db_session.commit()
    enr_id = enr.id

    # Transfer player to div_b
    resp = await client.post(
        "/admin/transfer-player",
        json={
            "user_id": target_id,
            "from_division_id": div_a_id,
            "to_division_id": div_b_id,
            "reason": "Player requested daytime division adjustment",
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # Verify enrollment updated
    db_session.expire_all()
    updated_enr = await db_session.get(Enrollment, enr_id)
    assert updated_enr is not None
    assert updated_enr.division_id == div_b_id

    # Verify AuditLog
    audit_stmt = select(AuditLog).where(AuditLog.action == "player_transferred_division")
    audit_res = await db_session.execute(audit_stmt)
    log = audit_res.scalar_one_or_none()
    assert log is not None
    assert log.actor_id == admin_id
    assert "daytime division adjustment" in log.reason


@pytest.mark.asyncio
async def test_resolve_dispute_and_live_standings(client: AsyncClient, db_session: AsyncSession):
    market_id, _program_id, div_a_id, _ = await _create_test_environment(db_session)

    # Admin
    admin_res = await client.post(
        "/auth/register",
        json={
            "email": "dispute_admin@example.com",
            "password": "Password123!",
            "display_name": "Admin",
        },
    )
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_user = (
        await db_session.execute(select(User).where(User.email == "dispute_admin@example.com"))
    ).scalar_one()
    admin_user.role = UserRole.MARKET_ADMIN
    await db_session.commit()

    # Players
    await client.post(
        "/auth/register",
        json={"email": "disp_p1@example.com", "password": "Password123!", "display_name": "P1"},
    )
    await client.post(
        "/auth/register",
        json={"email": "disp_p2@example.com", "password": "Password123!", "display_name": "P2"},
    )
    p1_user = (
        await db_session.execute(select(User).where(User.email == "disp_p1@example.com"))
    ).scalar_one()
    p2_user = (
        await db_session.execute(select(User).where(User.email == "disp_p2@example.com"))
    ).scalar_one()
    p1_id, p2_id = p1_user.id, p2_user.id

    p1_prof = (
        await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == p1_id))
    ).scalar_one()
    p2_prof = (
        await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == p2_id))
    ).scalar_one()

    # Match in dispute
    match = Match(
        market_id=market_id,
        division_id=div_a_id,
        winner_id=p1_prof.id,
        loser_id=p2_prof.id,
        reporter_id=p1_id,
        format="best_of_three",
        outcome_type="played",
        status=MatchStatus.DISPUTED,
        played_at=datetime.now(UTC),
        sets_json=json.dumps([{"winner": 6, "loser": 4}]),
    )
    db_session.add(match)
    await db_session.flush()

    dispute = MatchDispute(
        match_id=match.id,
        disputer_id=p2_id,
        reason="Score was recorded as 6-4 but set 2 was 4-6 and set 3 was 10-8 for P2",
        cooling_off_until=datetime.now(UTC),
        status=DisputeStatus.PENDING,
    )
    db_session.add(dispute)
    await db_session.commit()
    match_id = match.id
    dispute_id = dispute.id

    # Admin resolves dispute with corrected scores
    corrected = [
        {"winner": 6, "loser": 4},
        {"winner": 4, "loser": 6},
        {"winner": 1, "loser": 0},
    ]
    resp = await client.post(
        "/admin/resolve-dispute",
        json={
            "dispute_id": dispute_id,
            "resolution": DisputeStatus.RESOLVED_CHANGED,
            "admin_notes": "Reviewed screenshot of official court score sheet",
            "corrected_sets": corrected,
        },
        headers=admin_headers,
    )
    assert resp.status_code == 200

    # Verify updated dispute & match
    db_session.expire_all()
    updated_disp = await db_session.get(MatchDispute, dispute_id)
    assert updated_disp is not None
    assert updated_disp.status == DisputeStatus.RESOLVED_CHANGED
    assert updated_disp.admin_notes == "Reviewed screenshot of official court score sheet"

    updated_match = await db_session.get(Match, match_id)
    assert updated_match is not None
    assert updated_match.status == MatchStatus.CONFIRMED
    assert json.loads(updated_match.sets_json) == corrected

    # Verify AuditLog
    audit_stmt = select(AuditLog).where(AuditLog.entity_id == dispute_id)
    audit = (await db_session.execute(audit_stmt)).scalar_one_or_none()
    assert audit is not None
    assert audit.action == "dispute_resolved"


@pytest.mark.asyncio
async def test_manage_strike_and_void_match(client: AsyncClient, db_session: AsyncSession):
    market_id, _program_id, div_a_id, _ = await _create_test_environment(db_session)

    # Admin
    admin_res = await client.post(
        "/auth/register",
        json={
            "email": "discipline_admin@example.com",
            "password": "Password123!",
            "display_name": "Admin",
        },
    )
    admin_token = admin_res.json()["access_token"]
    admin_headers = {"Authorization": f"Bearer {admin_token}"}

    admin_user = (
        await db_session.execute(select(User).where(User.email == "discipline_admin@example.com"))
    ).scalar_one()
    admin_user.role = UserRole.MARKET_ADMIN
    await db_session.commit()
    admin_id = admin_user.id

    # Player & Strike
    await client.post(
        "/auth/register",
        json={
            "email": "strike_target@example.com",
            "password": "Password123!",
            "display_name": "Target",
        },
    )
    target_user = (
        await db_session.execute(select(User).where(User.email == "strike_target@example.com"))
    ).scalar_one()
    player_id = target_user.id

    prof_p = (
        await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == player_id))
    ).scalar_one()
    prof_p_id = prof_p.id

    admin_prof = (
        await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == admin_id))
    ).scalar_one()
    admin_prof_id = admin_prof.id

    strike = Strike(
        market_id=market_id,
        user_id=player_id,
        points=1,
        reason="Late cancellation within 2 hours",
        calendar_year=2026,
        status=StrikeStatus.CONFIRMED,
    )
    db_session.add(strike)
    await db_session.commit()
    strike_id = strike.id

    # 1. Admin dismisses strike upon valid proof
    strike_resp = await client.post(
        "/admin/manage-strike",
        json={
            "strike_id": strike_id,
            "action": "dismiss",
            "reason": "Player provided doctor certificate of acute injury",
        },
        headers=admin_headers,
    )
    assert strike_resp.status_code == 200
    db_session.expire_all()
    updated_strike = await db_session.get(Strike, strike_id)
    assert updated_strike is not None
    assert updated_strike.status == StrikeStatus.DISMISSED

    # 2. Void Match
    match = Match(
        market_id=market_id,
        division_id=div_a_id,
        winner_id=prof_p_id,
        loser_id=admin_prof_id,
        reporter_id=player_id,
        format="best_of_three",
        outcome_type="played",
        status=MatchStatus.CONFIRMED,
        played_at=datetime.now(UTC),
        sets_json=json.dumps([{"winner": 6, "loser": 0}]),
    )
    db_session.add(match)
    await db_session.commit()
    match_id = match.id

    void_resp = await client.post(
        "/admin/void-match",
        json={
            "match_id": match_id,
            "reason": "Match was entered as practice match by mistake",
        },
        headers=admin_headers,
    )
    assert void_resp.status_code == 200

    db_session.expire_all()
    updated_match = await db_session.get(Match, match_id)
    assert updated_match is not None
    assert updated_match.status == MatchStatus.VOIDED

    # Verify AuditLog for voided match
    audit_stmt = select(AuditLog).where(AuditLog.entity_id == match_id)
    audit = (await db_session.execute(audit_stmt)).scalar_one_or_none()
    assert audit is not None
    assert audit.action == "match_voided"
    assert "practice match" in audit.reason
