"""Pure domain module for league pricing, date/count-based tiers, and credit policies.

No framework dependencies (no FastAPI, no SQLAlchemy).
All prices and discounts are in integer cents (EUR/USD).
"""

import math
from dataclasses import dataclass, field
from datetime import UTC, datetime
from enum import StrEnum


class CreditType(StrEnum):
    REFERRAL = "referral"
    ACTIVITY = "activity"
    PROMO = "promo"
    GIFT_CARD = "gift_card"


@dataclass(frozen=True)
class Credit:
    id: str
    credit_type: CreditType
    amount_cents: int | None = None  # Fixed amount discount, e.g. 1000 for €10.00
    discount_pct: float | None = None  # Percentage, e.g. 0.3333 for 1/3 off, 0.08 for 8%
    valid_until: datetime | None = None
    consumed: bool = False

    def is_valid(self, now: datetime) -> bool:
        if self.consumed:
            return False
        if self.valid_until is not None:
            # Normalize timezone comparison
            now_utc = now if now.tzinfo else now.replace(tzinfo=UTC)
            expiry_utc = (
                self.valid_until
                if self.valid_until.tzinfo
                else self.valid_until.replace(tzinfo=UTC)
            )
            if now_utc > expiry_utc:
                return False
        return True

    def value_for(self, base_cents: int) -> int:
        """Calculate discount amount in cents given a base item cost."""
        if self.amount_cents is not None:
            return min(self.amount_cents, base_cents)
        if self.discount_pct is not None:
            val = math.floor(base_cents * self.discount_pct)
            return min(val, base_cents)
        return 0


@dataclass(frozen=True)
class PriceTier:
    """A pricing tier based on enrollment date cutoff or player count cutoff."""

    price_cents: int
    cutoff_time_utc: datetime | None = None  # e.g. early-bird cutoff
    max_count: int | None = None  # e.g. first 15 players


@dataclass
class CartItem:
    program_id: str
    program_type: str
    base_price_cents: int
    current_enrolled_count: int = 0
    price_tiers: list[PriceTier] = field(default_factory=list)


@dataclass
class QuoteLine:
    program_id: str
    unit_price_cents: int
    tier_applied: str = "standard"


@dataclass
class Quote:
    lines: list[QuoteLine]
    subtotal_cents: int
    discount_cents: int
    final_cost_cents: int
    applied_credit_id: str | None = None
    currency: str = "EUR"


def calculate_item_price(item: CartItem, now_utc: datetime) -> tuple[int, str]:
    """Determine price for an item applying date and count-based pricing tiers."""
    # Ensure now_utc has timezone info
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=UTC)

    # 1. Check count-based tier first (e.g. first 15 players)
    for tier in item.price_tiers:
        if tier.max_count is not None and item.current_enrolled_count < tier.max_count:
            return tier.price_cents, f"First {tier.max_count} players discount"

    # 2. Check date-based tier (e.g. early-bird before cutoff)
    for tier in item.price_tiers:
        if tier.cutoff_time_utc is not None:
            cutoff = (
                tier.cutoff_time_utc
                if tier.cutoff_time_utc.tzinfo
                else tier.cutoff_time_utc.replace(tzinfo=UTC)
            )
            if now_utc <= cutoff:
                return tier.price_cents, "Early bird discount"

    return item.base_price_cents, "standard"


def select_best_credit(credits: list[Credit], base_cents: int, now_utc: datetime) -> Credit | None:
    """Enforce league non-stacking policy (Coach's Rule):
    Only the single most valuable season credit applies (no double discounts).
    Referral credits override activity discounts if equal or higher.
    """
    valid_credits = [c for c in credits if c.is_valid(now_utc)]
    if not valid_credits:
        return None

    # Sort by discount value descending; prefer REFERRAL over ACTIVITY on ties
    def credit_priority(c: Credit) -> tuple[int, int]:
        val = c.value_for(base_cents)
        type_rank = 2 if c.credit_type == CreditType.REFERRAL else 1
        return (val, type_rank)

    best = max(valid_credits, key=credit_priority)
    if best.value_for(base_cents) == 0:
        return None
    return best


def quote_cart(
    items: list[CartItem],
    now_utc: datetime,
    available_credits: list[Credit] | None = None,
    currency: str = "EUR",
) -> Quote:
    """Calculate cart quote with pricing tiers and best single discount applied."""
    lines: list[QuoteLine] = []
    subtotal = 0

    for item in items:
        price, tier_desc = calculate_item_price(item, now_utc)
        lines.append(
            QuoteLine(program_id=item.program_id, unit_price_cents=price, tier_applied=tier_desc)
        )
        subtotal += price

    discount = 0
    applied_credit_id: str | None = None

    if available_credits and subtotal > 0:
        best_credit = select_best_credit(available_credits, subtotal, now_utc)
        if best_credit:
            discount = best_credit.value_for(subtotal)
            applied_credit_id = best_credit.id

    final_cost = max(0, subtotal - discount)

    return Quote(
        lines=lines,
        subtotal_cents=subtotal,
        discount_cents=discount,
        final_cost_cents=final_cost,
        applied_credit_id=applied_credit_id,
        currency=currency,
    )
