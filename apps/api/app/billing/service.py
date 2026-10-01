"""Billing service: quote generation, Stripe checkout sessions, and idempotent webhooks."""

import json
import uuid
from datetime import UTC, datetime
from typing import Any, cast

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.billing.models import CreditModel, Order, OrderItem, OrderStatus, ProcessedWebhookEvent
from app.billing.schemas import (
    CreateCheckoutSessionRequest,
)
from app.catalog.models import Program
from app.config import get_settings
from app.domain.pricing import CartItem, CreditType, Quote, quote_cart
from app.domain.pricing import Credit as DomainCredit
from app.leagues.models import Enrollment, EnrollmentStatus
from app.matches.models import AuditLog

settings = get_settings()


async def get_cart_quote(
    session: AsyncSession, user_id: str | None, program_ids: list[str]
) -> Quote:
    """Build cart quote using the pure domain pricing engine and available credits."""
    now_utc = datetime.now(UTC)

    # 1. Fetch programs
    stmt = select(Program).where(Program.id.in_(program_ids))
    res = await session.execute(stmt)
    programs = res.scalars().all()

    # If programs aren't in DB yet (seed fallback)
    cart_items: list[CartItem] = []
    if programs:
        for p in programs:
            cart_items.append(
                CartItem(
                    program_id=p.id,
                    program_type=p.program_type,
                    base_price_cents=p.price_cents,
                )
            )
    else:
        # Fallback default program
        for pid in program_ids:
            cart_items.append(
                CartItem(
                    program_id=pid,
                    program_type="flex_season",
                    base_price_cents=35000,  # GH₵ 350.00
                )
            )

    # 2. Fetch user's unconsumed credits
    domain_credits: list[DomainCredit] = []
    if user_id:
        credit_stmt = select(CreditModel).where(
            CreditModel.user_id == user_id, CreditModel.is_consumed == False
        )
        res_credits = await session.execute(credit_stmt)
        for c in res_credits.scalars().all():
            domain_credits.append(
                DomainCredit(
                    id=c.id,
                    credit_type=CreditType(c.credit_type),
                    amount_cents=c.amount_cents,
                    discount_pct=c.discount_pct,
                    valid_until=c.valid_until,
                    consumed=c.is_consumed,
                )
            )

    return quote_cart(
        cart_items,
        now_utc=now_utc,
        available_credits=domain_credits,
        currency=settings.DEFAULT_MARKET_CURRENCY,
    )


async def create_checkout_order(
    session: AsyncSession,
    user_id: str,
    market_id: str,
    req: CreateCheckoutSessionRequest,
) -> tuple[Order, str, str]:
    """Create a pending order and Stripe Checkout session."""
    quote = await get_cart_quote(session, user_id, req.program_ids)

    order = Order(
        market_id=market_id,
        user_id=user_id,
        status=OrderStatus.PENDING_PAYMENT,
        subtotal_cents=quote.subtotal_cents,
        discount_cents=quote.discount_cents,
        total_cents=quote.final_cost_cents,
        currency=quote.currency,
        applied_credit_id=quote.applied_credit_id,
    )
    session.add(order)
    await session.flush()

    for line in quote.lines:
        item = OrderItem(
            order_id=order.id,
            program_id=line.program_id,
            unit_price_cents=line.unit_price_cents,
        )
        session.add(item)

    # Check for real Stripe credentials vs sandbox/mock mode
    is_real_stripe = bool(
        settings.STRIPE_SECRET_KEY
        and not settings.STRIPE_SECRET_KEY.startswith("sk_test_placeholder")
    )

    if is_real_stripe:
        import stripe

        stripe.api_key = settings.STRIPE_SECRET_KEY
        line_items = [
            {
                "price_data": {
                    "currency": quote.currency.lower(),
                    "product_data": {
                        "name": f"Program Enrollment: {line.program_id}",
                    },
                    "unit_amount": line.unit_price_cents,
                },
                "quantity": 1,
            }
            for line in quote.lines
        ]
        stripe_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=cast(Any, line_items),
            mode="payment",
            success_url=req.success_url,
            cancel_url=req.cancel_url or req.success_url,
            client_reference_id=order.id,
            metadata={
                "order_id": order.id,
                "market_id": market_id,
                "user_id": user_id,
            },
        )
        session_id = stripe_session.id
        checkout_url = stripe_session.url or req.success_url.replace(
            "{CHECKOUT_SESSION_ID}", session_id
        )
    else:
        # Development / Sandbox simulation
        session_id = f"cs_test_{uuid.uuid4()}"
        checkout_url = req.success_url.replace("{CHECKOUT_SESSION_ID}", session_id)

    order.stripe_session_id = session_id
    await session.flush()

    return order, checkout_url, session_id


async def fulfill_stripe_checkout(
    session: AsyncSession,
    event_id: str,
    session_id: str,
    payment_intent_id: str | None = None,
) -> bool:
    """Fulfill order idempotently upon verified Stripe webhook delivery."""
    # 1. Idempotency check: has this event already been processed?
    idemp_stmt = select(ProcessedWebhookEvent).where(
        ProcessedWebhookEvent.stripe_event_id == event_id
    )
    res_idemp = await session.execute(idemp_stmt)
    if res_idemp.scalar_one_or_none():
        # Already processed, return immediately without duplicate side-effects
        return True

    # 2. Find order
    order_stmt = (
        select(Order)
        .where(Order.stripe_session_id == session_id)
        .options(selectinload(Order.items))
    )
    res_order = await session.execute(order_stmt)
    order = res_order.scalar_one_or_none()

    if not order:
        return False

    # 3. Transition order status
    order.status = OrderStatus.PAID
    if payment_intent_id:
        order.stripe_payment_intent_id = payment_intent_id

    # 4. Consume applied credit if present
    if order.applied_credit_id:
        credit_stmt = select(CreditModel).where(CreditModel.id == order.applied_credit_id)
        res_credit = await session.execute(credit_stmt)
        credit = res_credit.scalar_one_or_none()
        if credit:
            credit.is_consumed = True
            credit.consumed_order_id = order.id

    # 5. Create or activate enrollments for each program purchased
    for item in order.items:
        # Check if enrollment already exists
        enr_stmt = select(Enrollment).where(
            Enrollment.user_id == order.user_id,
            Enrollment.program_id == item.program_id,
        )
        enr = (await session.execute(enr_stmt)).scalar_one_or_none()
        if not enr:
            enr = Enrollment(
                market_id=order.market_id,
                user_id=order.user_id,
                program_id=item.program_id,
                status=EnrollmentStatus.ACTIVE,
            )
            session.add(enr)
        else:
            enr.status = EnrollmentStatus.ACTIVE

    # 6. Audit log entry
    audit = AuditLog(
        market_id=order.market_id,
        entity_type="order",
        entity_id=order.id,
        actor_id=order.user_id,
        action="stripe_checkout_completed",
        reason="Stripe webhook confirmed payment",
        changes_json=json.dumps({"total_cents": order.total_cents, "status": "paid"}),
    )
    session.add(audit)

    # 7. Record event in idempotency table
    processed_event = ProcessedWebhookEvent(
        stripe_event_id=event_id,
        event_type="checkout.session.completed",
    )
    session.add(processed_event)

    await session.commit()
    return True
