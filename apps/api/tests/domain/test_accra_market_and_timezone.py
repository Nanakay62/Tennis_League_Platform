"""Tests for Accra market, regions, partner matching, and Africa/Accra timezone cutoffs."""

from datetime import UTC, datetime
from zoneinfo import ZoneInfo

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.partners import (
    CandidatePartner,
    filter_and_rank_partners,
)
from app.domain.pricing import Credit, CreditType
from app.identity.service import get_or_create_default_market
from app.markets.models import Region


@pytest.mark.asyncio
async def test_accra_market_and_regions_creation(db_session: AsyncSession):
    """Verify market boots with Accra as the market and Tema/Accra as regions."""
    market = await get_or_create_default_market(db_session)
    assert market.slug == "accra"
    assert market.name == "Accra"
    assert market.timezone == "Africa/Accra"
    assert market.currency == "GHS"

    # Verify regions exist under market
    stmt = select(Region).where(Region.market_id == market.id)
    res = await db_session.execute(stmt)
    regions = {r.name for r in res.scalars().all()}
    assert "Accra" in regions
    assert "Tema" in regions


def test_partner_matching_surfaces_same_region_and_nearby_region_without_code_changes():
    """Verify partner matching surfaces same-region player first without logic changes."""
    candidates = [
        CandidatePartner(
            player_id="p-accra-1",
            display_name="Kwame Mensah",
            rating="3.5",
            home_area="Accra",
            is_daytime=True,
            phone="0244123456",
            email="kwame@example.com",
            matches_played_together=0,
        ),
        CandidatePartner(
            player_id="p-tema-1",
            display_name="Nana Osei",
            rating="3.5",
            home_area="Tema",
            is_daytime=True,
            phone="0244987654",
            email="nana@example.com",
            matches_played_together=0,
        ),
        CandidatePartner(
            player_id="p-far-skill",
            display_name="Out of Band Player",
            rating="4.5",  # Difference is 1.0 > 0.5 max rating diff
            home_area="Accra",
            is_daytime=True,
            phone=None,
            email=None,
        ),
    ]

    # Target player is in Accra, NTRP 3.5, Daytime
    ranked = filter_and_rank_partners(
        target_rating="3.5",
        target_home_area="Accra",
        target_is_daytime=True,
        candidates=candidates,
        max_rating_diff=0.5,
    )

    # Out of rating band (4.5) filtered out
    assert len(ranked) == 2

    # Player 1 (same region Accra) must rank first due to proximity bonus
    assert ranked[0].player_id == "p-accra-1"
    assert ranked[0].home_area == "Accra"

    # Player 2 (adjacent region Tema) is included within the same market
    assert ranked[1].player_id == "p-tema-1"
    assert ranked[1].home_area == "Tema"


def test_africa_accra_timezone_cutoff_boundary():
    """Verify timezone-dependent features use Africa/Accra correctly at exact cutoff boundaries.

    Handbook standard: Local times in market timezone must convert deterministically
    to UTC and strictly respect 23:59:59 boundary conditions.
    """
    tz_accra = ZoneInfo("Africa/Accra")

    # Cutoff deadline: 2026-11-20 23:59:59 Africa/Accra
    cutoff_local = datetime(2026, 11, 20, 23, 59, 59, tzinfo=tz_accra)
    cutoff_utc = cutoff_local.astimezone(UTC)

    # Since Africa/Accra is GMT (UTC+0), UTC time must match exactly
    assert cutoff_utc.hour == 23
    assert cutoff_utc.minute == 59
    assert cutoff_utc.second == 59
    assert cutoff_utc.day == 20
    assert cutoff_utc.month == 11
    assert cutoff_utc.year == 2026

    # 1 second before cutoff -> Valid
    one_sec_before_utc = datetime(2026, 11, 20, 23, 59, 58, tzinfo=UTC)
    credit = Credit(
        id="c-promo",
        credit_type=CreditType.PROMO,
        amount_cents=5000,
        valid_until=cutoff_utc,
    )
    assert credit.is_valid(now=one_sec_before_utc) is True

    # Exact boundary -> Valid
    assert credit.is_valid(now=cutoff_utc) is True

    # 1 second after boundary (2026-11-21 00:00:00) -> Expired
    one_sec_after_utc = datetime(2026, 11, 21, 0, 0, 0, tzinfo=UTC)
    assert credit.is_valid(now=one_sec_after_utc) is False
