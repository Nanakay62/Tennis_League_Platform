"""Unit tests for pricing tiers, cutoff boundaries, credits, and non-stacking rules."""

from datetime import UTC, datetime, timedelta

from app.domain.pricing import (
    CartItem,
    Credit,
    CreditType,
    PriceTier,
    quote_cart,
    select_best_credit,
)


def test_early_bird_date_cutoff_boundary():
    """Verify tier price applies 1 second before cutoff, and regular price 1 second after."""
    cutoff = datetime(2026, 9, 30, 23, 59, 59, tzinfo=UTC)
    early_price = 3295  # €32.95
    regular_price = 4495  # €44.95

    item = CartItem(
        program_id="fall-2026",
        program_type="flex_season",
        base_price_cents=regular_price,
        price_tiers=[PriceTier(price_cents=early_price, cutoff_time_utc=cutoff)],
    )

    # 1 second before cutoff: early-bird price
    before = cutoff - timedelta(seconds=1)
    quote_before = quote_cart([item], now_utc=before)
    assert quote_before.subtotal_cents == 3295
    assert quote_before.lines[0].unit_price_cents == 3295
    assert quote_before.lines[0].tier_applied == "Early bird discount"

    # Exactly at cutoff: early-bird price
    quote_exact = quote_cart([item], now_utc=cutoff)
    assert quote_exact.subtotal_cents == 3295

    # 1 second after cutoff: regular price
    after = cutoff + timedelta(seconds=1)
    quote_after = quote_cart([item], now_utc=after)
    assert quote_after.subtotal_cents == 4495
    assert quote_after.lines[0].unit_price_cents == 4495
    assert quote_after.lines[0].tier_applied == "standard"


def test_count_based_tier_boundary():
    """Verify first-15-players discount applies up to count 14, and regular price at 15+."""
    first_15_price = 2995  # €29.95
    regular_price = 3495  # €34.95
    tier = PriceTier(price_cents=first_15_price, max_count=15)

    now = datetime(2026, 10, 1, 12, 0, tzinfo=UTC)

    # 14 players enrolled: 15th player qualifies
    item_14 = CartItem(
        program_id="tourney-1",
        program_type="tourney",
        base_price_cents=regular_price,
        current_enrolled_count=14,
        price_tiers=[tier],
    )
    quote_14 = quote_cart([item_14], now_utc=now)
    assert quote_14.subtotal_cents == 2995
    assert "First 15" in quote_14.lines[0].tier_applied

    # 15 players enrolled: 16th player pays regular
    item_15 = CartItem(
        program_id="tourney-1",
        program_type="tourney",
        base_price_cents=regular_price,
        current_enrolled_count=15,
        price_tiers=[tier],
    )
    quote_15 = quote_cart([item_15], now_utc=now)
    assert quote_15.subtotal_cents == 3495
    assert quote_15.lines[0].tier_applied == "standard"


def test_no_stacking_selects_single_best_credit():
    """Rule 25 & Coach's Rule: Only the single highest discount applies."""
    base_cents = 4500  # €45.00
    now = datetime(2026, 10, 1, tzinfo=UTC)

    credit_activity = Credit(
        id="c1", credit_type=CreditType.ACTIVITY, discount_pct=0.15
    )  # 15% of 4500 = 675
    credit_referral = Credit(
        id="c2", credit_type=CreditType.REFERRAL, discount_pct=1 / 3
    )  # 33.3% of 4500 = 1500
    credit_promo = Credit(id="c3", credit_type=CreditType.PROMO, amount_cents=1000)  # €10.00 = 1000

    best = select_best_credit([credit_activity, credit_referral, credit_promo], base_cents, now)
    assert best is not None
    assert best.id == "c2"  # Referral credit is worth 1500 cents (highest)

    item = CartItem(program_id="season-1", program_type="flex_season", base_price_cents=base_cents)
    quote = quote_cart(
        [item], now_utc=now, available_credits=[credit_activity, credit_referral, credit_promo]
    )

    assert quote.subtotal_cents == 4500
    assert quote.discount_cents == 1500
    assert quote.final_cost_cents == 3000
    assert quote.applied_credit_id == "c2"


def test_expired_or_consumed_credits_are_ignored():
    """Ensure expired or already-consumed credits are not applied."""
    now = datetime(2026, 10, 1, tzinfo=UTC)
    expired = Credit(
        id="c-exp",
        credit_type=CreditType.PROMO,
        amount_cents=2000,
        valid_until=datetime(2026, 9, 1, tzinfo=UTC),
    )
    consumed = Credit(
        id="c-con",
        credit_type=CreditType.PROMO,
        amount_cents=2000,
        consumed=True,
    )

    best = select_best_credit([expired, consumed], 4500, now)
    assert best is None
