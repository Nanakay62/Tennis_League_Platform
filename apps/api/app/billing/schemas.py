"""Pydantic schemas for cart quotes, checkout sessions, and orders."""

from pydantic import BaseModel, Field


class QuoteItemResponse(BaseModel):
    program_id: str
    unit_price_cents: int
    tier_applied: str


class QuoteRequest(BaseModel):
    program_ids: list[str] = Field(min_length=1)


class QuoteResponse(BaseModel):
    items: list[QuoteItemResponse]
    subtotal_cents: int
    discount_cents: int
    final_cost_cents: int
    applied_credit_id: str | None = None
    currency: str = "EUR"


class CreateCheckoutSessionRequest(BaseModel):
    program_ids: list[str] = Field(min_length=1)
    success_url: str = Field(
        default="http://localhost:8081/checkout/result?session_id={CHECKOUT_SESSION_ID}"
    )
    cancel_url: str = Field(default="http://localhost:8081/join")


class CheckoutSessionResponse(BaseModel):
    order_id: str
    checkout_url: str
    session_id: str


class OrderItemResponse(BaseModel):
    program_id: str
    unit_price_cents: int


class OrderResponse(BaseModel):
    id: str
    market_id: str
    user_id: str
    status: str
    subtotal_cents: int
    discount_cents: int
    total_cents: int
    currency: str
    items: list[OrderItemResponse]
