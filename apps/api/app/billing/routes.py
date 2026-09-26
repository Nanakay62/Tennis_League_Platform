"""Billing API routes: cart quote, checkout session creation, webhooks, and orders."""

import json

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.billing.models import Order
from app.billing.schemas import (
    CheckoutSessionResponse,
    CreateCheckoutSessionRequest,
    OrderItemResponse,
    OrderResponse,
    QuoteItemResponse,
    QuoteRequest,
    QuoteResponse,
)
from app.billing.service import create_checkout_order, fulfill_stripe_checkout, get_cart_quote
from app.config import get_settings
from app.db import get_db
from app.identity.deps import get_current_user
from app.identity.models import User

settings = get_settings()
router = APIRouter(tags=["billing"])


@router.post("/cart/quote", response_model=QuoteResponse)
async def quote_cart_endpoint(
    req: QuoteRequest,
    session: AsyncSession = Depends(get_db),
):
    """Calculate exact server-side pricing quote with tier rules and discounts."""
    quote = await get_cart_quote(session, user_id=None, program_ids=req.program_ids)
    return QuoteResponse(
        items=[
            QuoteItemResponse(
                program_id=line.program_id,
                unit_price_cents=line.unit_price_cents,
                tier_applied=line.tier_applied,
            )
            for line in quote.lines
        ],
        subtotal_cents=quote.subtotal_cents,
        discount_cents=quote.discount_cents,
        final_cost_cents=quote.final_cost_cents,
        applied_credit_id=quote.applied_credit_id,
        currency=quote.currency,
    )


@router.post("/checkout/sessions", response_model=CheckoutSessionResponse)
async def create_checkout_session(
    req: CreateCheckoutSessionRequest,
    user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """Create a new pending order and Stripe Checkout Session."""
    order, checkout_url, session_id = await create_checkout_order(
        session=session,
        user_id=user.id,
        market_id=user.market_id,
        req=req,
    )
    return CheckoutSessionResponse(
        order_id=order.id,
        checkout_url=checkout_url,
        session_id=session_id,
    )


@router.post("/webhooks/stripe")
async def stripe_webhook(
    request: Request,
    stripe_signature: str | None = Header(default=None),
    session: AsyncSession = Depends(get_db),
):
    """Handle Stripe payment webhooks idempotently."""
    payload_bytes = await request.body()

    try:
        data = json.loads(payload_bytes)
    except (json.JSONDecodeError, ValueError):
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_id = data.get("id")
    event_type = data.get("type")

    if not event_id or not event_type:
        raise HTTPException(status_code=400, detail="Missing event metadata")

    if event_type == "checkout.session.completed":
        session_obj = data.get("data", {}).get("object", {})
        session_id = session_obj.get("id")
        payment_intent_id = session_obj.get("payment_intent")

        if session_id:
            await fulfill_stripe_checkout(
                session=session,
                event_id=event_id,
                session_id=session_id,
                payment_intent_id=payment_intent_id,
            )

    return {"status": "success"}


@router.get("/orders/{order_id}", response_model=OrderResponse)
async def get_order_status(
    order_id: str,
    session: AsyncSession = Depends(get_db),
):
    """Retrieve order status and item lines for checkout result polling."""
    stmt = select(Order).where(Order.id == order_id).options(selectinload(Order.items))
    res = await session.execute(stmt)
    order = res.scalar_one_or_none()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    return OrderResponse(
        id=order.id,
        market_id=order.market_id,
        user_id=order.user_id,
        status=order.status,
        subtotal_cents=order.subtotal_cents,
        discount_cents=order.discount_cents,
        total_cents=order.total_cents,
        currency=order.currency,
        items=[
            OrderItemResponse(
                program_id=item.program_id,
                unit_price_cents=item.unit_price_cents,
            )
            for item in order.items
        ],
    )
