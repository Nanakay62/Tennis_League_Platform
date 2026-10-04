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
            "display_name": "Kojo Winner",
            "phone": "+233 24 111 1111",
            "home_area": "Accra",
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
            "display_name": "Kwesi Opponent",
            "phone": "+233 24 222 2222",
            "home_area": "Accra",
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
        region="Accra",
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
    await db_session.flush()

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
    assert match_data["winner_name"] == "Kojo Winner"
    assert match_data["loser_name"] == "Kwesi Opponent"
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
    assert feed[0]["winner_name"] == "Kojo Winner"
    assert feed[0]["loser_name"] == "Kwesi Opponent"
    assert "6-3; 6-4" in feed[0]["score_line"]

    # 8. Contact details gating:
    # Player 1 is enrolled -> can access roster with opponent phone and email
    roster_res = await client.get("/divisions/div-test-comp/roster", headers=p1_headers)
    assert roster_res.status_code == 200
    roster = roster_res.json()
    assert len(roster) == 2
    p2_entry = next(r for r in roster if r["display_name"] == "Kwesi Opponent")
    assert p2_entry["phone"] == "+233 24 222 2222"
    assert p2_entry["email"] == "p2_loser@example.com"

    # Player 3 is NOT enrolled in this division -> 403 Forbidden!
    outsider_roster = await client.get("/divisions/div-test-comp/roster", headers=p3_headers)
    assert outsider_roster.status_code == 403
    assert "Contact details are only accessible to active" in outsider_roster.json()["detail"]


@pytest.mark.asyncio
async def test_no_show_walkover_and_strike_creation(
    client: AsyncClient, db_session: AsyncSession, seeded_catalog: None
):
    # Setup players
    p1_res = await client.post(
        "/auth/register",
        json={
            "email": "noshow_winner@example.com",
            "password": "Password123!",
            "display_name": "P1 Winner",
            "home_area": "Accra",
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
            "home_area": "Accra",
        },
    )
    assert p2_res.status_code == 201

    u1 = (
        await db_session.execute(select(User).where(User.email == "noshow_winner@example.com"))
    ).scalar_one()
    u2 = (
        await db_session.execute(select(User).where(User.email == "noshow_loser@example.com"))
    ).scalar_one()
    prof2 = (
        await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == u2.id))
    ).scalar_one()
    p2_prof_id = prof2.id

    # Enroll both players in div-accra-comp-1
    db_session.add_all(
        [
            Enrollment(
                market_id=u1.market_id,
                program_id="prog-accra-fall-2026",
                division_id="div-accra-comp-1",
                user_id=u1.id,
                status=EnrollmentStatus.ACTIVE,
            ),
            Enrollment(
                market_id=u2.market_id,
                program_id="prog-accra-fall-2026",
                division_id="div-accra-comp-1",
                user_id=u2.id,
                status=EnrollmentStatus.ACTIVE,
            ),
        ]
    )
    await db_session.commit()

    # 1. Report no-show having only waited 10 minutes -> rejected
    bad_wait = {
        "division_id": "div-accra-comp-1",
        "opponent_id": p2_prof_id,
        "outcome_type": "no_show",
        "minutes_waited": 10,
    }
    bad_res = await client.post("/matches", json=bad_wait, headers=p1_headers)
    assert bad_res.status_code == 400
    assert "wait at least 20 minutes" in bad_res.json()["detail"]

    # 2. Report no-show having waited 25 minutes -> accepted as walkover, strike proposed
    good_wait = {
        "division_id": "div-accra-comp-1",
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


@pytest.mark.asyncio
async def test_handicap_check_api_endpoint(
    client: AsyncClient, db_session: AsyncSession, seeded_catalog: None
):
    """Deliverable 1B: Integration tests for GET /matches/handicap-check against real seeded database."""
    # 1. Log in as Kwame (rating 4.0, 6 verified matches)
    login_res = await client.post(
        "/auth/login",
        json={"email": "kwame@accratennis.com", "password": "Password123!"},
    )
    assert login_res.status_code == 200
    kwame_token = login_res.json()["access_token"]
    kwame_headers = {"Authorization": f"Bearer {kwame_token}"}

    # 2. Check against Kofi (rating 3.0, 6 verified matches -> gap 1.0 > 0.5)
    # Must be eligible for 30-0 lead! Exact 6 matches derived from real matches
    eligible_res = await client.get(
        "/matches/handicap-check?opponent_id=p-seed-kofi",
        headers=kwame_headers,
    )
    assert eligible_res.status_code == 200
    data = eligible_res.json()
    assert data["eligible"] is True
    assert data["lead"] == "30-0"
    assert data["court"] == "Deuce court"
    assert data["lower_rated_player_id"] == "p-seed-kofi"
    assert data["lower_rated_player_name"] == "Kofi Boateng"
    assert data["rating_gap"] == 1.0
    assert data["my_match_count"] == 6
    assert data["opponent_match_count"] == 6

    # 3. Check against Emmanuel (rating 3.5, 6 verified matches -> gap 0.5 <= 0.5)
    # Must be ineligible due to insufficient gap
    gap_res = await client.get(
        "/matches/handicap-check?opponent_id=p-seed-emmanuel",
        headers=kwame_headers,
    )
    assert gap_res.status_code == 200
    gap_data = gap_res.json()
    assert gap_data["eligible"] is False
    assert "greater than 0.5" in gap_data["reason"]
    assert gap_data["lead"] is None

    # 4. Check against an unverified new player (< 6 matches)
    unv_res = await client.post(
        "/auth/register",
        json={
            "email": "newbie@accratennis.com",
            "password": "Password123!",
            "display_name": "New Player",
            "rating": "2.5",
            "home_area": "Accra",
        },
    )
    assert unv_res.status_code == 201

    p_row = (
        await db_session.execute(
            select(PlayerProfile).where(PlayerProfile.display_name == "New Player")
        )
    ).scalar_one()
    newbie_prof_id = p_row.id

    unv_check = await client.get(
        f"/matches/handicap-check?opponent_id={newbie_prof_id}",
        headers=kwame_headers,
    )
    assert unv_check.status_code == 200
    assert unv_check.json()["eligible"] is False
    assert "at least 6 confirmed matches" in unv_check.json()["reason"]


@pytest.mark.asyncio
async def test_reporter_cannot_self_confirm(client: AsyncClient, seeded_catalog: None):
    # Kwame reports match vs Kofi
    login_kwame = await client.post(
        "/auth/login", json={"email": "kwame@accratennis.com", "password": "Password123!"}
    )
    kwame_headers = {"Authorization": f"Bearer {login_kwame.json()['access_token']}"}

    sub_res = await client.post(
        "/matches",
        json={
            "division_id": "div-accra-comp-1",
            "opponent_id": "p-seed-kofi",
            "i_am_winner": True,
            "format": "best_of_three",
            "outcome_type": "played",
            "sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 2}],
        },
        headers=kwame_headers,
    )
    assert sub_res.status_code == 201
    mid = sub_res.json()["id"]

    # Reporter attempts to confirm own match -> 403 Forbidden
    conf_res = await client.post(f"/matches/{mid}/confirm", headers=kwame_headers)
    assert conf_res.status_code == 403


@pytest.mark.asyncio
async def test_stranger_cannot_confirm(client: AsyncClient, seeded_catalog: None):
    login_kwame = await client.post(
        "/auth/login", json={"email": "kwame@accratennis.com", "password": "Password123!"}
    )
    kwame_headers = {"Authorization": f"Bearer {login_kwame.json()['access_token']}"}

    sub_res = await client.post(
        "/matches",
        json={
            "division_id": "div-accra-comp-1",
            "opponent_id": "p-seed-kofi",
            "i_am_winner": True,
            "format": "best_of_three",
            "outcome_type": "played",
            "sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 2}],
        },
        headers=kwame_headers,
    )
    assert sub_res.status_code == 201
    mid = sub_res.json()["id"]

    # Emmanuel is in division but is NOT a participant in this match -> 403 Forbidden
    login_emmanuel = await client.post(
        "/auth/login", json={"email": "emmanuel@accratennis.com", "password": "Password123!"}
    )
    emmanuel_headers = {"Authorization": f"Bearer {login_emmanuel.json()['access_token']}"}

    conf_res = await client.post(f"/matches/{mid}/confirm", headers=emmanuel_headers)
    assert conf_res.status_code == 403


@pytest.mark.asyncio
async def test_submit_unknown_division_404(client: AsyncClient, seeded_catalog: None):
    login_kwame = await client.post(
        "/auth/login", json={"email": "kwame@accratennis.com", "password": "Password123!"}
    )
    kwame_headers = {"Authorization": f"Bearer {login_kwame.json()['access_token']}"}

    r = await client.post(
        "/matches",
        json={
            "division_id": "div-unknown-nonexistent",
            "opponent_id": "p-seed-kofi",
            "i_am_winner": True,
            "format": "best_of_three",
            "outcome_type": "played",
            "sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 2}],
        },
        headers=kwame_headers,
    )
    assert r.status_code == 404


@pytest.mark.asyncio
async def test_submit_unenrolled_opponent_403(
    client: AsyncClient, db_session: AsyncSession, seeded_catalog: None
):
    login_kwame = await client.post(
        "/auth/login", json={"email": "kwame@accratennis.com", "password": "Password123!"}
    )
    kwame_headers = {"Authorization": f"Bearer {login_kwame.json()['access_token']}"}

    # Register an unenrolled user in Accra
    await client.post(
        "/auth/register",
        json={
            "email": "unenrolled_accra@accratennis.com",
            "password": "Password123!",
            "display_name": "Unenrolled Player",
            "home_area": "Accra",
        },
    )
    u = (
        await db_session.execute(
            select(PlayerProfile).where(PlayerProfile.display_name == "Unenrolled Player")
        )
    ).scalar_one()

    r = await client.post(
        "/matches",
        json={
            "division_id": "div-accra-comp-1",
            "opponent_id": u.id,
            "i_am_winner": True,
            "format": "best_of_three",
            "outcome_type": "played",
            "sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 2}],
        },
        headers=kwame_headers,
    )
    assert r.status_code == 403


@pytest.mark.asyncio
async def test_dispute_confirmed_match_conflicts(client: AsyncClient, seeded_catalog: None):
    login_kwame = await client.post(
        "/auth/login", json={"email": "kwame@accratennis.com", "password": "Password123!"}
    )
    kwame_headers = {"Authorization": f"Bearer {login_kwame.json()['access_token']}"}

    login_kofi = await client.post(
        "/auth/login", json={"email": "kofi@accratennis.com", "password": "Password123!"}
    )
    kofi_headers = {"Authorization": f"Bearer {login_kofi.json()['access_token']}"}

    # Kwame reports match
    sub = await client.post(
        "/matches",
        json={
            "division_id": "div-accra-comp-1",
            "opponent_id": "p-seed-kofi",
            "i_am_winner": True,
            "format": "best_of_three",
            "outcome_type": "played",
            "sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 2}],
        },
        headers=kwame_headers,
    )
    assert sub.status_code == 201
    mid = sub.json()["id"]

    # Kofi confirms match
    conf = await client.post(f"/matches/{mid}/confirm", headers=kofi_headers)
    assert conf.status_code == 200

    # Kofi attempts to dispute already-confirmed match -> 409 Conflict
    disp = await client.post(
        f"/matches/{mid}/dispute",
        json={"reason": "Disputing settled match"},
        headers=kofi_headers,
    )
    assert disp.status_code == 409
