import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_health_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"
        assert data["market"] == "Frankfurt"
        assert data["timezone"] == "Europe/Berlin"


@pytest.mark.asyncio
async def test_programs_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/programs")
        assert response.status_code == 200
        data = response.json()
        assert len(data) >= 1
        assert data[0]["name"] == "Frankfurt Fall Season 2026"
        assert data[0]["currency"] == "EUR"
        assert data[0]["priceCents"] == 3495


@pytest.mark.asyncio
async def test_divisions_standings_endpoint():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        response = await client.get("/divisions/div-comp-1/standings")
        assert response.status_code == 200
        standings = response.json()
        assert len(standings) == 4

        # Rank 1: Lukas Schmidt (5-1, diff +4)
        assert standings[0]["rank"] == 1
        assert standings[0]["playerName"] == "Lukas Schmidt"
        assert standings[0]["wins"] == 5
        assert standings[0]["losses"] == 1
        assert standings[0]["playoffIndicator"] == "+4"
        assert standings[0]["isPlayoffEligible"] is True
        assert standings[0]["gamesPctDisplay"] == "0.706 (36-15)"

        # Rank 2: Maximilian Weber (4-2, diff +2)
        assert standings[1]["rank"] == 2
        assert standings[1]["playerName"] == "Maximilian Weber"
        assert standings[1]["wins"] == 4
        assert standings[1]["losses"] == 2
