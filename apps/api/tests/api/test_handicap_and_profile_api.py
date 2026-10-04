"""Integration tests for Handicap Scoring and Profile Free-Text fields."""

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select

from app.identity.models import PlayerProfile, User
from app.main import app
from app.matches.models import Match


@pytest.mark.asyncio
async def test_handicap_check_and_match_submission(db_session, seeded_catalog):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Register Player 1 (Rating 4.5)
        res1 = await client.post(
            "/auth/register",
            json={
                "email": "player_adv@example.com",
                "password": "Password123!",
                "display_name": "Advanced Player",
                "rating": "4.5",
                "home_area": "Accra",
                "favorite_link": "https://tennislab.com/tips",
                "game_description": "Aggressive serve-and-volleyer",
                "about_me": "Playing for 15 years",
            },
        )
        assert res1.status_code == 201
        token1 = res1.json()["access_token"]
        headers1 = {"Authorization": f"Bearer {token1}"}

        # 2. Register Player 2 (Rating 3.5)
        res2 = await client.post(
            "/auth/register",
            json={
                "email": "player_rec@example.com",
                "password": "Password123!",
                "display_name": "Recreational Player",
                "rating": "3.5",
                "home_area": "Accra",
            },
        )
        assert res2.status_code == 201
        token2 = res2.json()["access_token"]

        # Fetch profile IDs
        stmt1 = select(PlayerProfile).join(User).where(User.email == "player_adv@example.com")
        p1 = (await db_session.execute(stmt1)).scalar_one()

        stmt2 = select(PlayerProfile).join(User).where(User.email == "player_rec@example.com")
        p2 = (await db_session.execute(stmt2)).scalar_one()

        from app.leagues.models import Enrollment, EnrollmentStatus

        db_session.add(
            Enrollment(
                market_id=p1.market_id,
                user_id=p1.user_id,
                program_id="prog-accra-fall-2026",
                division_id="div-accra-comp-1",
                status=EnrollmentStatus.ACTIVE,
            )
        )
        db_session.add(
            Enrollment(
                market_id=p2.market_id,
                user_id=p2.user_id,
                program_id="prog-accra-fall-2026",
                division_id="div-accra-comp-1",
                status=EnrollmentStatus.ACTIVE,
            )
        )
        await db_session.commit()

        # 3. Check handicap when players have 0 matches (< 6 required)
        check_res = await client.get(
            f"/matches/handicap-check?opponent_id={p2.id}",
            headers=headers1,
        )
        assert check_res.status_code == 200
        data = check_res.json()
        assert not data["eligible"]
        assert "at least 6 confirmed matches" in data["reason"]

        # Attempt submitting handicap match -> should fail 400
        submit_fail = await client.post(
            "/matches",
            headers=headers1,
            json={
                "division_id": "div-accra-comp-1",
                "opponent_id": p2.id,
                "i_am_winner": True,
                "format": "best_of_three",
                "outcome_type": "played",
                "is_handicap": True,
                "sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 3}],
            },
        )
        assert submit_fail.status_code == 400
        assert "at least 6 confirmed matches" in submit_fail.json()["detail"]

        # 4. Give both players 6 matches via veteran_match_count
        p1.veteran_match_count = 6
        p2.veteran_match_count = 7
        await db_session.commit()

        # 5. Check handicap eligibility again
        check_res2 = await client.get(
            f"/matches/handicap-check?opponent_id={p2.id}",
            headers=headers1,
        )
        assert check_res2.status_code == 200
        data2 = check_res2.json()
        assert data2["eligible"]
        assert data2["lead"] == "30-0"
        assert data2["court"] == "Deuce court"
        assert data2["lower_rated_player_id"] == p2.id
        assert data2["lower_rated_player_name"] == "Recreational Player"
        assert data2["rating_gap"] == 1.0

        # 6. Submit valid handicap match
        submit_ok = await client.post(
            "/matches",
            headers=headers1,
            json={
                "division_id": "div-accra-comp-1",
                "opponent_id": p2.id,
                "i_am_winner": True,
                "format": "best_of_three",
                "outcome_type": "played",
                "is_handicap": True,
                "sets": [{"winner": 6, "loser": 4}, {"winner": 6, "loser": 3}],
            },
        )
        assert submit_ok.status_code == 201
        m_data = submit_ok.json()
        assert m_data["is_handicap"] is True
        assert m_data["handicap_lead"] == "30-0"
        assert m_data["handicap_recipient_id"] == p2.id

        # Verify DB match record
        m_id = m_data["id"]
        m_stmt = select(Match).where(Match.id == m_id)
        db_match = (await db_session.execute(m_stmt)).scalar_one()
        assert db_match.is_handicap is True
        assert db_match.handicap_lead == "30-0"
        assert db_match.handicap_recipient_id == p2.id

        # 7. Check latest score feed displays handicap badge
        # Confirm match first
        headers2 = {"Authorization": f"Bearer {token2}"}
        conf_res = await client.post(f"/matches/{m_id}/confirm", headers=headers2)
        assert conf_res.status_code == 200

        feed_res = await client.get("/scores/latest")
        assert feed_res.status_code == 200
        feed_items = feed_res.json()
        target_item = next((item for item in feed_items if item["id"] == m_id), None)
        assert target_item is not None
        assert target_item["is_handicap"] is True
        assert target_item["handicap_lead"] == "30-0"


@pytest.mark.asyncio
async def test_profile_freetext_validation_and_update(db_session):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Register user
        reg_res = await client.post(
            "/auth/register",
            json={
                "email": "freetext_test@example.com",
                "password": "Password123!",
                "display_name": "FreeText Tester",
                "rating": "3.5",
            },
        )
        assert reg_res.status_code == 201
        token = reg_res.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Check /me initially has null free-text fields
        me_res = await client.get("/me", headers=headers)
        assert me_res.status_code == 200
        me_profile = me_res.json()["profile"]
        assert me_profile["favorite_link"] is None
        assert me_profile["game_description"] is None
        assert me_profile["about_me"] is None

        # Test invalid URL for favorite_link -> rejected
        bad_url_res = await client.patch(
            "/me/profile",
            headers=headers,
            json={"favorite_link": "not-a-valid-url"},
        )
        assert bad_url_res.status_code == 422

        # Test valid URL and free-text updates
        good_update_res = await client.patch(
            "/me/profile",
            headers=headers,
            json={
                "favorite_link": "https://tennisprofile.org/player123",
                "game_description": "Aggressive baseliner with heavy topspin forehand.",
                "about_me": "Looking for weekly hits on clay or hard courts.",
            },
        )
        assert good_update_res.status_code == 200
        data = good_update_res.json()
        assert data["favorite_link"] == "https://tennisprofile.org/player123"
        assert data["game_description"] == "Aggressive baseliner with heavy topspin forehand."
        assert data["about_me"] == "Looking for weekly hits on clay or hard courts."

        # Fetch /me again to verify persistence
        me_res2 = await client.get("/me", headers=headers)
        me_profile2 = me_res2.json()["profile"]
        assert me_profile2["favorite_link"] == "https://tennisprofile.org/player123"
        assert (
            me_profile2["game_description"] == "Aggressive baseliner with heavy topspin forehand."
        )
        assert me_profile2["about_me"] == "Looking for weekly hits on clay or hard courts."

        # Delete / anonymize user -> should scrub free-text fields
        del_res = await client.delete("/me", headers=headers)
        assert del_res.status_code == 204

        # Verify DB directly
        u_stmt = select(User).where(User.email.like("deleted-%@anonymized.local"))
        del_user = (await db_session.execute(u_stmt)).scalars().first()
        assert del_user is not None
        p_stmt = select(PlayerProfile).where(PlayerProfile.user_id == del_user.id)
        del_profile = (await db_session.execute(p_stmt)).scalar_one()
        assert del_profile.display_name == "Former Player"
        assert del_profile.favorite_link is None
        assert del_profile.game_description is None
        assert del_profile.about_me is None
