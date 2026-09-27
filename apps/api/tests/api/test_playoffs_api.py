"""Integration tests for division playoffs, bracket generation, and match advancement."""

from datetime import date as datetime_date

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division, Program
from app.identity.models import PlayerProfile, User
from app.leagues.models import StandingRowModel
from app.playoffs.models import BracketStatus


@pytest.mark.asyncio
async def test_playoffs_generation_and_match_advancement(
    client: AsyncClient, db_session: AsyncSession
):
    # 1. Register 4 players
    tokens = []
    user_ids = []
    profile_ids = []

    for i in range(1, 5):
        res = await client.post(
            "/auth/register",
            json={
                "email": f"playoff_p{i}@example.com",
                "password": "Password123!",
                "display_name": f"Playoff Player {i}",
                "phone": f"+49 170 00000{i}",
            },
        )
        assert res.status_code == 201
        tokens.append(res.json()["access_token"])

        u = (
            await db_session.execute(select(User).where(User.email == f"playoff_p{i}@example.com"))
        ).scalar_one()
        prof = (
            await db_session.execute(select(PlayerProfile).where(PlayerProfile.user_id == u.id))
        ).scalar_one()
        user_ids.append(u.id)
        profile_ids.append(prof.id)

    # 2. Setup division and standings in DB
    u1 = (await db_session.execute(select(User).where(User.id == user_ids[0]))).scalar_one()

    prog = Program(
        id="prog-playoffs-1",
        market_id=u1.market_id,
        name="Fall 2026 Playoffs Test",
        slug="fall-2026-playoffs-test",
        start_date=datetime_date(2026, 10, 1),
        end_date=datetime_date(2026, 11, 20),
        price_cents=3495,
    )
    db_session.add(prog)

    div = Division(
        id="div-playoffs-comp",
        market_id=u1.market_id,
        program_id="prog-playoffs-1",
        name="Competitive Playoff Div",
        rating_band="3.5",
    )
    db_session.add(div)

    # Add 4 qualified standings rows (all have >= 3 wins)
    for i in range(4):
        sr = StandingRowModel(
            division_id="div-playoffs-comp",
            player_id=profile_ids[i],
            rank=i + 1,
            wins=6 - i,  # 6, 5, 4, 3 wins
            losses=i,
            games_won=36 - i * 4,
            games_lost=15 + i * 4,
            distinct_opponents=4,
            playoff_indicator=f"+{6 - 2 * i}",
            is_playoff_eligible=True,
        )
        db_session.add(sr)
    await db_session.commit()

    # 3. Generate Playoffs with min_wins=3 so all 4 qualify
    gen_res = await client.post(
        "/divisions/div-playoffs-comp/playoffs/generate",
        json={"min_wins": 3, "enable_veteran_seeding": False},
    )
    assert gen_res.status_code == 201
    bracket = gen_res.json()
    assert bracket["bracket_size"] == 4
    assert bracket["total_rounds"] == 2
    assert bracket["status"] == "active"
    assert len(bracket["rounds"]["1"]) == 2  # Semifinals
    assert len(bracket["rounds"]["2"]) == 1  # Final

    # Check Semifinal 1 match (Seed 1 vs Seed 4)
    sf1 = bracket["rounds"]["1"][0]
    assert sf1["player1"]["id"] == profile_ids[0]
    assert sf1["player2"]["id"] == profile_ids[3]
    sf1_id = sf1["id"]

    # Check Semifinal 2 match (Seed 2 vs Seed 3)
    sf2 = bracket["rounds"]["1"][1]
    assert sf2["player1"]["id"] == profile_ids[1]
    assert sf2["player2"]["id"] == profile_ids[2]
    sf2_id = sf2["id"]

    # 4. Fetch playoffs via GET /divisions/{id}/playoffs
    get_res = await client.get("/divisions/div-playoffs-comp/playoffs")
    assert get_res.status_code == 200
    brackets_list = get_res.json()
    assert len(brackets_list) == 1
    assert brackets_list[0]["id"] == bracket["id"]

    # 5. Report Score for Semifinal 1: Player 1 wins 6-2, 6-3
    score_res = await client.post(
        f"/playoffs/matches/{sf1_id}/score",
        json={"winner_id": profile_ids[0], "score_summary": "6-2, 6-3"},
    )
    assert score_res.status_code == 200
    assert score_res.json()["winner"]["id"] == profile_ids[0]

    # Verify Final match now has Player 1 as participant
    final_res = await client.get("/divisions/div-playoffs-comp/playoffs")
    final_match = final_res.json()[0]["rounds"]["2"][0]
    assert final_match["player1"]["id"] == profile_ids[0]
    assert final_match["player2"] is None  # Waiting for SF2 winner

    # 6. Report Score for Semifinal 2: Player 2 wins 7-5, 6-4
    await client.post(
        f"/playoffs/matches/{sf2_id}/score",
        json={"winner_id": profile_ids[1], "score_summary": "7-5, 6-4"},
    )

    # Verify Final match now has both Player 1 and Player 2!
    final_res2 = await client.get("/divisions/div-playoffs-comp/playoffs")
    final_match2 = final_res2.json()[0]["rounds"]["2"][0]
    assert final_match2["player1"]["id"] == profile_ids[0]
    assert final_match2["player2"]["id"] == profile_ids[1]

    # 7. Complete the Final: Player 1 wins Championship!
    final_id = final_match2["id"]
    await client.post(
        f"/playoffs/matches/{final_id}/score",
        json={"winner_id": profile_ids[0], "score_summary": "6-4, 4-6, 7-6"},
    )

    # Verify bracket status is completed
    completed_res = await client.get("/divisions/div-playoffs-comp/playoffs")
    assert completed_res.json()[0]["status"] == BracketStatus.COMPLETED
