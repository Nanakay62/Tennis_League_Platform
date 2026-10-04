"""Integration tests for division constraints (gender & age) and partial-success placement reporting."""

import pytest
from httpx import AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.catalog.models import Division, Program
from app.identity.models import User, UserRole
from app.markets.models import Market


@pytest.mark.asyncio
async def test_registration_with_gender_and_birth_year(client: AsyncClient):
    resp = await client.post(
        "/auth/register",
        json={
            "email": "jane_doe@example.com",
            "password": "Password123!",
            "display_name": "Jane Doe",
            "gender": "female",
            "birth_year": 1982,
        },
    )
    assert resp.status_code == 201
    tokens = resp.json()
    token = tokens["access_token"]

    # Check /me profile
    me_resp = await client.get("/me", headers={"Authorization": f"Bearer {token}"})
    assert me_resp.status_code == 200
    profile = me_resp.json()["profile"]
    assert profile["gender"] == "female"
    assert profile["birth_year"] == 1982


@pytest.mark.asyncio
async def test_division_constraints_bulk_placement_partial_reporting(
    client: AsyncClient, db_session: AsyncSession
):
    # Setup market and program
    market = Market(name="Test Market", slug="test-market", timezone="Africa/Accra", currency="GHS")
    db_session.add(market)
    await db_session.flush()

    from datetime import date

    program = Program(
        market_id=market.id,
        name="Test Program",
        slug="test-program",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 3, 1),
    )
    db_session.add(program)
    await db_session.flush()

    # Create Men's only division and 40+ division
    mens_div = Division(
        market_id=market.id,
        program_id=program.id,
        name="Men's Competitive",
        rating_band="3.5",
        gender_constraint="men",
    )
    senior_div = Division(
        market_id=market.id,
        program_id=program.id,
        name="Senior 40+",
        rating_band="3.5",
        gender_constraint="open",
        min_age=40,
    )
    db_session.add_all([mens_div, senior_div])
    await db_session.commit()

    # Register admin
    admin_res = await client.post(
        "/auth/register",
        json={
            "email": "div_admin@example.com",
            "password": "Password123!",
            "display_name": "Div Admin",
        },
    )
    admin_token = admin_res.json()["access_token"]
    admin_user = (
        await db_session.execute(select(User).where(User.email == "div_admin@example.com"))
    ).scalar_one()
    admin_user.role = UserRole.SUPER_ADMIN
    await db_session.commit()

    # Register Player 1: Male, born 1980 (age 46 in 2026)
    p1_res = await client.post(
        "/auth/register",
        json={
            "email": "p1_male@example.com",
            "password": "Password123!",
            "display_name": "Male Player",
            "gender": "male",
            "birth_year": 1980,
        },
    )
    assert p1_res.status_code == 201
    p1_user = (
        await db_session.execute(select(User).where(User.email == "p1_male@example.com"))
    ).scalar_one()

    # Register Player 2: Female, born 1980 (age 46 in 2026)
    p2_res = await client.post(
        "/auth/register",
        json={
            "email": "p2_female@example.com",
            "password": "Password123!",
            "display_name": "Female Player",
            "gender": "female",
            "birth_year": 1980,
        },
    )
    assert p2_res.status_code == 201
    p2_user = (
        await db_session.execute(select(User).where(User.email == "p2_female@example.com"))
    ).scalar_one()

    # Register Player 3: Male, born 2000 (age 26 in 2026)
    p3_res = await client.post(
        "/auth/register",
        json={
            "email": "p3_young@example.com",
            "password": "Password123!",
            "display_name": "Young Player",
            "gender": "male",
            "birth_year": 2000,
        },
    )
    assert p3_res.status_code == 201
    p3_user = (
        await db_session.execute(select(User).where(User.email == "p3_young@example.com"))
    ).scalar_one()

    # 1. Bulk place into Men's division: P1 (male) and P2 (female)
    # Expected: P1 placed, P2 skipped and reported
    place_resp = await client.post(
        "/admin/bulk-placement",
        json={"division_id": mens_div.id, "user_ids": [p1_user.id, p2_user.id]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert place_resp.status_code == 200
    data = place_resp.json()
    assert "Successfully placed 1 players" in data["message"]
    assert "Skipped 1 ineligible player(s)" in data["message"]
    assert "restricted to Men's players" in data["message"]

    # 2. Bulk place into Senior 40+ division: P1 (age 46) and P3 (age 26)
    # Expected: P1 placed, P3 skipped and reported
    senior_resp = await client.post(
        "/admin/bulk-placement",
        json={"division_id": senior_div.id, "user_ids": [p1_user.id, p3_user.id]},
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert senior_resp.status_code == 200
    s_data = senior_resp.json()
    assert "Successfully placed 1 players" in s_data["message"]
    assert "Skipped 1 ineligible player(s)" in s_data["message"]
    assert "at least 40 years old" in s_data["message"]

    # 3. Transfer test: Attempt to transfer Female player into Men's division -> fails with 400
    transfer_resp = await client.post(
        "/admin/transfer-player",
        json={
            "user_id": p2_user.id,
            "from_division_id": senior_div.id,
            "to_division_id": mens_div.id,
            "reason": "Transfer request",
        },
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert transfer_resp.status_code == 400
    assert "restricted to Men's players" in transfer_resp.json()["detail"]
