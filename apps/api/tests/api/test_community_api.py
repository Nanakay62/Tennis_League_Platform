"""Integration tests for community endpoints: partner matching, courts directory, reviews, and referrals."""

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.community.models import Court
from app.identity.service import get_or_create_default_market


@pytest.mark.asyncio
async def test_partner_matching_within_rating_band(client: AsyncClient, db_session: AsyncSession):
    # 1. Register base user (3.5 in Sachsenhausen)
    res0 = await client.post(
        "/auth/register",
        json={
            "email": "base_player@example.com",
            "password": "Password123!",
            "display_name": "Base Player",
            "rating": "3.5",
            "home_area": "Sachsenhausen",
            "is_daytime": True,
        },
    )
    assert res0.status_code == 201
    token0 = res0.json()["access_token"]
    headers0 = {"Authorization": f"Bearer {token0}"}

    # 2. Register candidate 1: 3.0 (compatible, within 0.5)
    res1 = await client.post(
        "/auth/register",
        json={
            "email": "candidate_30@example.com",
            "password": "Password123!",
            "display_name": "Candidate 3.0",
            "rating": "3.0",
            "home_area": "Sachsenhausen",
            "is_daytime": True,
        },
    )
    assert res1.status_code == 201

    # 3. Register candidate 2: 5.0 (outside 0.5 band)
    res2 = await client.post(
        "/auth/register",
        json={
            "email": "candidate_50@example.com",
            "password": "Password123!",
            "display_name": "Candidate 5.0",
            "rating": "5.0",
            "home_area": "Westend",
            "is_daytime": False,
        },
    )
    assert res2.status_code == 201

    # 4. Query GET /partners
    partners_res = await client.get("/partners", headers=headers0)
    assert partners_res.status_code == 200
    partners = partners_res.json()

    matched_names = [p["display_name"] for p in partners]
    assert "Candidate 3.0" in matched_names
    assert "Candidate 5.0" not in matched_names
    assert "Base Player" not in matched_names  # self excluded


@pytest.mark.asyncio
async def test_courts_directory_and_reviews(client: AsyncClient, db_session: AsyncSession):
    # 1. Register a user
    user_res = await client.post(
        "/auth/register",
        json={
            "email": "reviewer@example.com",
            "password": "Password123!",
            "display_name": "Court Reviewer",
        },
    )
    token = user_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    market = await get_or_create_default_market(db_session)

    # 2. Seed courts in db
    c1 = Court(
        market_id=market.id,
        name="TC Palmengarten",
        slug="tc-palmengarten",
        address="Palmengartenstraße 10",
        postal_code="60323",
        city="Frankfurt am Main",
        num_courts=8,
        surface="clay",
        has_lights=True,
        is_indoor=False,
        has_hitting_wall=True,
    )
    c2 = Court(
        market_id=market.id,
        name="Tennisclub Kalbach Indoor",
        slug="tc-kalbach-indoor",
        address="Am Sportzentrum 3",
        postal_code="60437",
        city="Frankfurt am Main",
        num_courts=4,
        surface="carpet",
        has_lights=True,
        is_indoor=True,
        has_hitting_wall=False,
    )
    db_session.add(c1)
    db_session.add(c2)
    await db_session.commit()

    # 3. Query all courts
    all_courts_res = await client.get("/courts")
    assert all_courts_res.status_code == 200
    all_courts = all_courts_res.json()
    assert len(all_courts) >= 2

    # 4. Query courts filtered by surface=clay
    clay_res = await client.get("/courts?surface=clay")
    assert clay_res.status_code == 200
    clay_courts = clay_res.json()
    assert any(c["name"] == "TC Palmengarten" for c in clay_courts)
    assert not any(c["name"] == "Tennisclub Kalbach Indoor" for c in clay_courts)

    # 5. Get detail of TC Palmengarten
    court_detail_res = await client.get(f"/courts/{c1.id}")
    assert court_detail_res.status_code == 200
    detail = court_detail_res.json()
    assert detail["name"] == "TC Palmengarten"
    assert detail["review_count"] == 0

    # 6. Post review for TC Palmengarten
    review_res = await client.post(
        f"/courts/{c1.id}/reviews",
        json={"rating": 5, "comment": "Excellent red clay courts and good lighting!"},
        headers=headers,
    )
    assert review_res.status_code == 201
    assert review_res.json()["rating"] == 5

    # 7. Check updated average rating in detail
    updated_res = await client.get(f"/courts/{c1.id}")
    updated_detail = updated_res.json()
    assert updated_detail["review_count"] == 1
    assert updated_detail["average_rating"] == 5.0
    assert len(updated_detail["reviews"]) == 1


@pytest.mark.asyncio
async def test_referral_info_and_poty_endpoints(client: AsyncClient, db_session: AsyncSession):
    # 1. Register a user
    user_res = await client.post(
        "/auth/register",
        json={
            "email": "referral_user@example.com",
            "password": "Password123!",
            "display_name": "Referrer User",
        },
    )
    token = user_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Query GET /community/referral
    ref_res = await client.get("/community/referral", headers=headers)
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert "referral_code" in ref_data
    assert "referral_link" in ref_data
    assert ref_data["reward_credit_cents"] == 500

    # 3. Query GET /community/poty
    poty_res = await client.get("/community/poty")
    assert poty_res.status_code == 200
    assert isinstance(poty_res.json(), list)
