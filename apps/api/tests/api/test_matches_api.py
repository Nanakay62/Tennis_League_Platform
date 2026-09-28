"""Integration tests for match score reporting, format validation, confirmation, disputes, contact gating, and latest scores feed."""

from datetime import date as datetime_date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division, Program
from app.identity.models import PlayerProfile, User
from app.leagues.models import Enrollment, EnrollmentStatus
from app.matches.models import Strike


@pytest.mark.asyncio
async def test_full_match_submission_confirm_and_roster_gating(
    client: AsyncClient, db_session: AsyncSession
):
    # 1. Register Player 1 (Winner)
    p1_res = await client.post(
        "/auth/register",
        json={
            "email": "p1_winner@example.com",
            "password": "Password123!",
            "display_name": "Lukas Winner",
            "phone": "+49 171 111111",
            "home_area": "Sachsenhausen",
        },
    )
    assert p1_res.status_code == 201
    p1_token = p1_res.json()["access_token"]
    p1_headers = {"Authorization": f"Bearer {p1_token}"}

    # 2. Register Player 2 (Opponent)
    p2_res = await client.post(
        "/auth/register",
        json={
            "email": "p2_loser@example.com",
            "password": "Password123!",
            "display_name": "Max Opponent",
            "phone": "+49 172 222222",
            "home_area": "Westend",
        },
    )
    assert p2_res.status_code == 201
    p2_token = p2_res.json()["access_token"]
    p2_headers = {"Authorization": f"Bearer {p2_token}"}

    # 3. Register Player 3 (Unenrolled outsider)
    p3_res = await client.post(
        "/auth/register",
        json={
            "email": "p3_outsider@example.com",
            "password": "Password123!",
            "display_name": "Outsider User",
        },
    )
    assert p3_res.status_code == 201
    p3_token = p3_res.json()["access_token"]
    p3_headers = {"Authorization": f"Bearer {p3_token}"}

    # 4. Set up program, division, and enrollments in DB
    u1 = (
        await db_session.execute(select(User).where(User.email == "p1_winner@example.com"))
    ).scalar_one()
    u2 = (
        await db_session.execute(select(User).where(User.email == "p2_loser@example.com"))
    ).scalar_one()
    prof2 = (
        await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == u2.id))
    ).scalar_one()
    p2_profile_id = prof2.id

    prog = Program(
        id="prog-test-1",
        market_id=u1.market_id,
        name="Fall 2026 Test",
        slug="fall-2026-test",
        start_date=datetime_date(2026, 10, 1),
        end_date=datetime_date(2026, 11, 20),
        price_cents=3495,
    )
    db_session.add(prog)

    div = Division(
        id="div-test-comp",
        market_id=u1.market_id,
        program_id="prog-test-1",
        name="Competitive 3.5 Test",
        rating_band="3.5",
    )
    db_session.add(div)

    # Enroll both p1 and p2
    enr1 = Enrollment(
        market_id=u1.market_id,
        program_id="prog-test-1",
        division_id="div-test-comp",
        user_id=u1.id,
        status=EnrollmentStatus.ACTIVE,
    )
    enr2 = Enrollment(
        market_id=u1.market_id,
        program_id="prog-test-1",
        division_id="div-test-comp",
        user_id=u2.id,
        status=EnrollmentStatus.ACTIVE,
    )
    db_session.add(enr1)
    db_session.add(enr2)
    await db_session.commit()

    # 5. Submit valid score: Player 1 reports 6-3, 6-4 against Player 2
    submit_payload = {
        "division_id": "div-test-comp",
        "opponent_id": p2_profile_id,
        "i_am_winner": True,
        "format": "best_of_three",
        "outcome_type": "played",
        "sets": [{"winner": 6, "loser": 3}, {"winner": 6, "loser": 4}],
    }
    sub_res = await client.post("/matches", json=submit_payload, headers=p1_headers)
    assert sub_res.status_code == 201
    match_data = sub_res.json()
    match_id = match_data["id"]
    assert match_data["status"] == "submitted"
    assert match_data["winner_name"] == "Lukas Winner"
    assert match_data["loser_name"] == "Max Opponent"
    assert match_data["sets_summary"] == "6-3; 6-4"

    # 6. Opponent (Player 2) confirms the score
    conf_res = await client.post(f"/matches/{match_id}/confirm", headers=p2_headers)
    assert conf_res.status_code == 200
    assert conf_res.json()["match_status"] == "confirmed"

    # 7. Check Latest Scores Feed
    feed_res = await client.get("/scores/latest")
    assert feed_res.status_code == 200
    feed = feed_res.json()
    assert len(feed) >= 1
    assert feed[0]["winner_name"] == "Lukas Winner"
    assert feed[0]["loser_name"] == "Max Opponent"
    assert "6-3; 6-4" in feed[0]["score_line"]

    # 8. Contact details gating:
    # Player 1 is enrolled -> can access roster with opponent phone and email
    roster_res = await client.get("/divisions/div-test-comp/roster", headers=p1_headers)
    assert roster_res.status_code == 200
    roster = roster_res.json()
    assert len(roster) == 2
    p2_entry = next(r for r in roster if r["display_name"] == "Max Opponent")
    assert p2_entry["phone"] == "+49 172 222222"
    assert p2_entry["email"] == "p2_loser@example.com"

    # Player 3 is NOT enrolled in this division -> 403 Forbidden!
    outsider_roster = await client.get("/divisions/div-test-comp/roster", headers=p3_headers)
    assert outsider_roster.status_code == 403
    assert "Contact details are only accessible to active" in outsider_roster.json()["detail"]


@pytest.mark.asyncio
async def test_no_show_walkover_and_strike_creation(client: AsyncClient, db_session: AsyncSession):
    # Setup players
    p1_res = await client.post(
        "/auth/register",
        json={
            "email": "noshow_winner@example.com",
            "password": "Password123!",
            "display_name": "P1 Winner",
        },
    )
    assert p1_res.status_code == 201
    p1_token = p1_res.json()["access_token"]
    p1_headers = {"Authorization": f"Bearer {p1_token}"}

    p2_res = await client.post(
        "/auth/register",
        json={
            "email": "noshow_loser@example.com",
            "password": "Password123!",
            "display_name": "P2 NoShow",
        },
    )
    assert p2_res.status_code == 201

    u2 = (
        await db_session.execute(select(User).where(User.email == "noshow_loser@example.com"))
    ).scalar_one()
    prof2 = (
        await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == u2.id))
    ).scalar_one()
    p2_prof_id = prof2.id

    # 1. Report no-show having only waited 10 minutes -> rejected
    bad_wait = {
        "division_id": "div-comp-1",
        "opponent_id": p2_prof_id,
        "outcome_type": "no_show",
        "minutes_waited": 10,
    }
    bad_res = await client.post("/matches", json=bad_wait, headers=p1_headers)
    assert bad_res.status_code == 400
    assert "wait at least 20 minutes" in bad_res.json()["detail"]

    # 2. Report no-show having waited 25 minutes -> accepted as walkover, strike proposed
    good_wait = {
        "division_id": "div-comp-1",
        "opponent_id": p2_prof_id,
        "outcome_type": "no_show",
        "minutes_waited": 25,
    }
    good_res = await client.post("/matches", json=good_wait, headers=p1_headers)
    assert good_res.status_code == 201
    assert good_res.json()["status"] == "confirmed"

    # Verify strike created in DB
    strike = (
        await db_session.execute(select(Strike).where(Strike.user_id == u2.id))
    ).scalar_one_or_none()
    assert strike is not None
    assert strike.points == 2
    assert strike.status == "proposed"
    assert "No-show" in strike.reason
