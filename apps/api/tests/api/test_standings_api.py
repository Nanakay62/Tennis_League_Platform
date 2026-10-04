import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["market"] == "Accra"
        assert data["timezone"] == "Africa/Accra"
        assert data["database"] == "ok"


@pytest.mark.asyncio
async def test_programs_endpoint(seeded_catalog: None):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/programs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 2
        program_names = [p["name"] for p in data]
        assert "Accra Fall Season 2026" in program_names
        assert "Tema Fall Season 2026" in program_names


@pytest.mark.asyncio
async def test_program_divisions_endpoints(seeded_catalog: None):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Accra divisions
        accra_res = await client.get("/programs/prog-accra-fall-2026/divisions")
        assert accra_res.status_code == 200
        accra_divs = accra_res.json()
        assert len(accra_divs) >= 2
        accra_ids = [d["id"] for d in accra_divs]
        assert "div-accra-comp-1" in accra_ids
        assert "div-accra-skilled-1" in accra_ids

        # Tema divisions
        tema_res = await client.get("/programs/prog-tema-fall-2026/divisions")
        assert tema_res.status_code == 200
        tema_divs = tema_res.json()
        assert len(tema_divs) >= 2
        tema_ids = [d["id"] for d in tema_divs]
        assert "div-tema-comp-1" in tema_ids
        assert "div-tema-skilled-1" in tema_ids


@pytest.mark.asyncio
async def test_accra_and_tema_standings_endpoints(seeded_catalog: None):
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Accra Competitive Standings
        accra_response = await client.get("/divisions/div-accra-comp-1/standings")
        assert accra_response.status_code == 200
        accra_standings = accra_response.json()
        assert len(accra_standings) == 4

        # Rank 1: Kwame Mensah (5-1, diff +4)
        assert accra_standings[0]["rank"] == 1
        assert accra_standings[0]["playerName"] == "Kwame Mensah"
        assert accra_standings[0]["homeArea"] == "Accra"
        assert accra_standings[0]["wins"] == 5
        assert accra_standings[0]["losses"] == 1
        assert accra_standings[0]["isPlayoffEligible"] is True

        # Rank 2: Kofi Boateng (5-1, diff +3, playoff eligible)
        assert accra_standings[1]["rank"] == 2
        assert accra_standings[1]["playerName"] == "Kofi Boateng"
        assert accra_standings[1]["homeArea"] == "Accra"
        assert accra_standings[1]["wins"] == 5
        assert accra_standings[1]["losses"] == 1
        assert accra_standings[1]["isPlayoffEligible"] is True

        # Tema Competitive Standings
        tema_response = await client.get("/divisions/div-tema-comp-1/standings")
        assert tema_response.status_code == 200
        tema_standings = tema_response.json()
        assert len(tema_standings) == 4
        assert tema_standings[0]["playerName"] == "Nana Osei"
        assert tema_standings[0]["homeArea"] == "Tema"
        assert tema_standings[0]["wins"] == 5


@pytest.mark.asyncio
async def test_standings_unknown_division_404(client: AsyncClient, seeded_catalog: None):
    assert (await client.get("/divisions/div-nope/standings")).status_code == 404


@pytest.mark.asyncio
async def test_standings_get_does_not_write(
    client: AsyncClient, seeded_catalog: None, db_session: AsyncSession
):
    from sqlalchemy import func, select

    from app.leagues.models import StandingRowModel

    before = (await db_session.execute(select(func.count(StandingRowModel.id)))).scalar_one()
    res = await client.get("/divisions/div-accra-comp-1/standings")
    assert res.status_code == 200
    after = (await db_session.execute(select(func.count(StandingRowModel.id)))).scalar_one()
    assert before == after


@pytest.mark.asyncio
async def test_standings_only_returns_requested_division(client: AsyncClient, seeded_catalog: None):
    a = (await client.get("/divisions/div-accra-comp-1/standings")).json()
    t = (await client.get("/divisions/div-tema-comp-1/standings")).json()
    assert {r["playerId"] for r in a}.isdisjoint({r["playerId"] for r in t})


@pytest.mark.asyncio
async def test_seed_standings_stable_under_recalculation(
    db_session: AsyncSession, seeded_catalog: None
):
    from sqlalchemy import select

    from app.leagues.models import StandingRowModel
    from app.matches.service import recalculate_division_standings

    stmt = (
        select(
            StandingRowModel.player_id,
            StandingRowModel.rank,
            StandingRowModel.wins,
            StandingRowModel.losses,
        )
        .where(StandingRowModel.division_id == "div-accra-comp-1")
        .order_by(StandingRowModel.rank.asc())
    )
    before = (await db_session.execute(stmt)).all()

    await recalculate_division_standings(db_session, "div-accra-comp-1")

    after = (await db_session.execute(stmt)).all()
    assert before == after
