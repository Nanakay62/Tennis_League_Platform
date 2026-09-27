"""Integration tests for background jobs, push notifications, and device management."""

import json
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division, Program
from app.domain.scoring import MatchFormat
from app.identity.models import PlayerProfile, User
from app.jobs import (
    run_auto_confirm_matches,
    run_kickoff_broadcast,
    run_nightly_backup,
)
from app.leagues.models import Enrollment, EnrollmentStatus
from app.matches.models import AuditLog, Match, MatchStatus


@pytest.mark.asyncio
async def test_device_registration_and_listing(client: AsyncClient, db_session: AsyncSession):
    """Test device push token registration, unregistration, and validation."""
    # 1. Register test user
    res = await client.post(
        "/auth/register",
        json={
            "email": "device_user@example.com",
            "password": "Password123!",
            "display_name": "Device Tester",
            "rating": "3.5",
            "home_area": "Sachsenhausen",
        },
    )
    assert res.status_code == 201
    token = res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Register valid push token
    dev_res = await client.post(
        "/devices",
        headers=headers,
        json={
            "push_token": "ExponentPushToken[device-tester-token-123]",
            "platform": "ios",
        },
    )
    assert dev_res.status_code == 201
    dev_data = dev_res.json()
    assert dev_data["push_token"] == "ExponentPushToken[device-tester-token-123]"
    assert dev_data["is_active"] is True

    # 3. List registered devices
    list_res = await client.get("/devices", headers=headers)
    assert list_res.status_code == 200
    assert len(list_res.json()) == 1

    # 4. Attempt to register invalid push token -> 422
    bad_res = await client.post(
        "/devices",
        headers=headers,
        json={"push_token": "invalid_raw_token", "platform": "android"},
    )
    assert bad_res.status_code == 422

    # 5. Unregister device
    del_res = await client.delete(
        "/devices/ExponentPushToken[device-tester-token-123]",
        headers=headers,
    )
    assert del_res.status_code == 204

    # 6. List devices should now be empty (active only)
    list_after = await client.get("/devices", headers=headers)
    assert list_after.status_code == 200
    assert len(list_after.json()) == 0


@pytest.mark.asyncio
async def test_kickoff_broadcast_job_with_gated_contacts(
    client: AsyncClient, db_session: AsyncSession
):
    """Test kickoff broadcast job dispatches notifications with opponent contacts strictly within division."""
    # 1. Create program and division
    from app.identity.service import get_or_create_default_market

    market = await get_or_create_default_market(db_session)

    from datetime import date

    prog = Program(
        market_id=market.id,
        name="Fall Season 2026",
        slug="fall-season-2026",
        program_type="flex_season",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 11, 20),
    )
    db_session.add(prog)
    await db_session.flush()

    div = Division(
        market_id=market.id,
        program_id=prog.id,
        name="3.5 Fall Division",
        rating_band="3.5",
    )
    db_session.add(div)
    await db_session.flush()

    # 2. Register Player A and Player B
    res_a = await client.post(
        "/auth/register",
        json={
            "email": "kickoff_a@example.com",
            "password": "Password123!",
            "display_name": "Player Alpha",
            "phone": "+49170111111",
            "rating": "3.5",
        },
    )
    user_a = (
        await db_session.execute(select(User).where(User.email == "kickoff_a@example.com"))
    ).scalar_one()
    user_a_id = user_a.id
    headers_a = {"Authorization": f"Bearer {res_a.json()['access_token']}"}

    await client.post(
        "/auth/register",
        json={
            "email": "kickoff_b@example.com",
            "password": "Password123!",
            "display_name": "Player Beta",
            "phone": "+49170222222",
            "rating": "3.5",
        },
    )
    user_b = (
        await db_session.execute(select(User).where(User.email == "kickoff_b@example.com"))
    ).scalar_one()
    user_b_id = user_b.id

    # Register push device for Player A
    await client.post(
        "/devices",
        headers=headers_a,
        json={"push_token": "ExponentPushToken[player-a-token]", "platform": "ios"},
    )

    # 3. Enroll both into division
    enr_a = Enrollment(
        market_id=market.id,
        program_id=prog.id,
        division_id=div.id,
        user_id=user_a_id,
        status=EnrollmentStatus.PLACED_IN_DIVISION,
    )
    enr_b = Enrollment(
        market_id=market.id,
        program_id=prog.id,
        division_id=div.id,
        user_id=user_b_id,
        status=EnrollmentStatus.PLACED_IN_DIVISION,
    )
    db_session.add_all([enr_a, enr_b])
    await db_session.commit()

    # 4. Trigger kickoff broadcast
    result = await run_kickoff_broadcast(division_id=div.id, session=db_session)
    assert result["status"] == "ok"
    assert result["recipients_count"] == 2

    # 5. Check Player A notification history
    hist_res = await client.get("/notifications/history", headers=headers_a)
    assert hist_res.status_code == 200
    history = hist_res.json()
    assert len(history) >= 1
    # Check that kickoff notification was recorded
    kickoff_notif = next((h for h in history if h["event_type"] == "kickoff"), None)
    assert kickoff_notif is not None
    assert "3.5 Fall Division" in kickoff_notif["title"]

    # 6. Check AuditLog entry created for kickoff broadcast
    stmt = select(AuditLog).where(
        AuditLog.entity_id == div.id,
        AuditLog.action == "division_kickoff_broadcast",
    )
    audit = (await db_session.execute(stmt)).scalar_one_or_none()
    assert audit is not None


@pytest.mark.asyncio
async def test_auto_confirm_expired_matches(client: AsyncClient, db_session: AsyncSession):
    """Test auto-confirmation of matches older than 48 hours without disputes."""
    from app.identity.service import get_or_create_default_market

    market = await get_or_create_default_market(db_session)

    from datetime import date

    # 1. Setup division
    prog = Program(
        market_id=market.id,
        name="Winter 2026",
        slug="winter-2026",
        program_type="flex_season",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 2, 28),
    )
    db_session.add(prog)
    await db_session.flush()

    div = Division(
        market_id=market.id,
        program_id=prog.id,
        name="4.0 League",
        rating_band="4.0",
    )
    db_session.add(div)
    await db_session.flush()

    # 2. Register winner and loser
    await client.post(
        "/auth/register",
        json={
            "email": "winner@example.com",
            "password": "Password123!",
            "display_name": "Winner 1",
        },
    )
    user1 = (
        await db_session.execute(select(User).where(User.email == "winner@example.com"))
    ).scalar_one()
    prof1_stmt = select(PlayerProfile).where(PlayerProfile.user_id == user1.id)
    prof1 = (await db_session.execute(prof1_stmt)).scalar_one()

    await client.post(
        "/auth/register",
        json={"email": "loser@example.com", "password": "Password123!", "display_name": "Loser 1"},
    )
    user2 = (
        await db_session.execute(select(User).where(User.email == "loser@example.com"))
    ).scalar_one()
    prof2_stmt = select(PlayerProfile).where(PlayerProfile.user_id == user2.id)
    prof2 = (await db_session.execute(prof2_stmt)).scalar_one()

    # 3. Create a match submitted 50 hours ago (should auto-confirm)
    past_time = datetime.now(UTC) - timedelta(hours=50)
    match_expired = Match(
        market_id=market.id,
        division_id=div.id,
        winner_id=prof1.id,
        loser_id=prof2.id,
        format=MatchFormat.BEST_OF_THREE,
        outcome_type="played",
        sets_json=json.dumps([{"winner": 6, "loser": 4}, {"winner": 6, "loser": 3}]),
        status=MatchStatus.SUBMITTED,
        reporter_id=user1.id,
        played_at=past_time,
        created_at=past_time,
    )
    db_session.add(match_expired)

    # 4. Create a second match submitted 10 hours ago (should NOT auto-confirm yet)
    recent_time = datetime.now(UTC) - timedelta(hours=10)
    match_recent = Match(
        market_id=market.id,
        division_id=div.id,
        winner_id=prof1.id,
        loser_id=prof2.id,
        format=MatchFormat.BEST_OF_THREE,
        outcome_type="played",
        sets_json=json.dumps([{"winner": 6, "loser": 2}, {"winner": 6, "loser": 1}]),
        status=MatchStatus.SUBMITTED,
        reporter_id=user1.id,
        played_at=recent_time,
        created_at=recent_time,
    )
    db_session.add(match_recent)
    await db_session.commit()

    # 5. Run auto-confirmation job
    job_res = await run_auto_confirm_matches(market_id=market.id, session=db_session)
    assert job_res["status"] == "ok"
    assert job_res["auto_confirmed_count"] == 1

    # 6. Verify match statuses
    await db_session.refresh(match_expired)
    await db_session.refresh(match_recent)
    assert match_expired.status == MatchStatus.CONFIRMED
    assert match_recent.status == MatchStatus.SUBMITTED


@pytest.mark.asyncio
async def test_nightly_backup_job(client: AsyncClient, db_session: AsyncSession):
    """Test nightly database backup task and audit logging."""
    from app.identity.service import get_or_create_default_market

    market = await get_or_create_default_market(db_session)

    res = await run_nightly_backup(market_id=market.id, market_slug="frankfurt", session=db_session)
    assert res["status"] == "ok"
    assert res["filename"].startswith("backup_frankfurt_")
    assert res["filename"].endswith(".sql.gz.enc")

    # Verify AuditLog row
    stmt = select(AuditLog).where(
        AuditLog.entity_id == res["filename"],
        AuditLog.action == "nightly_database_backup",
    )
    audit = (await db_session.execute(stmt)).scalar_one_or_none()
    assert audit is not None
