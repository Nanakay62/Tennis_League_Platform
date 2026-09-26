"""Integration tests for cart quotes, checkout session creation, orders, and idempotent Stripe webhooks."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_cart_quote_endpoint(client: AsyncClient):
    payload = {"program_ids": ["prog-frankfurt-fall-2026"]}
    res = await client.post("/cart/quote", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["subtotal_cents"] == 3495
    assert data["discount_cents"] == 0
    assert data["final_cost_cents"] == 3495
    assert data["currency"] == "EUR"
    assert len(data["items"]) == 1


@pytest.mark.asyncio
async def test_create_checkout_session_and_order_status(client: AsyncClient):
    # 1. Register player
    reg_payload = {
        "email": "buyer@example.com",
        "password": "Password123!",
        "display_name": "Test Buyer",
    }
    reg_res = await client.post("/auth/register", json=reg_payload)
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create checkout session
    checkout_payload = {
        "program_ids": ["prog-frankfurt-fall-2026"],
        "success_url": "http://localhost:8081/checkout/result?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": "http://localhost:8081/join",
    }
    session_res = await client.post("/checkout/sessions", json=checkout_payload, headers=headers)
    assert session_res.status_code == 200
    data = session_res.json()
    assert "order_id" in data
    assert "session_id" in data
    assert "checkout_url" in data
    order_id = data["order_id"]

    # 3. Check order status (should be pending_payment)
    order_res = await client.get(f"/orders/{order_id}")
    assert order_res.status_code == 200
    order_data = order_res.json()
    assert order_data["id"] == order_id
    assert order_data["status"] == "pending_payment"
    assert order_data["total_cents"] == 3495


@pytest.mark.asyncio
async def test_stripe_webhook_fulfillment_and_idempotency(client: AsyncClient):
    # 1. Register player and create order
    reg_payload = {
        "email": "webhook_player@example.com",
        "password": "Password123!",
        "display_name": "Webhook Player",
    }
    reg_res = await client.post("/auth/register", json=reg_payload)
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    checkout_payload = {
        "program_ids": ["prog-frankfurt-fall-2026"],
        "success_url": "http://localhost:8081/checkout/result?session_id={CHECKOUT_SESSION_ID}",
    }
    session_res = await client.post("/checkout/sessions", json=checkout_payload, headers=headers)
    order_id = session_res.json()["order_id"]
    session_id = session_res.json()["session_id"]

    # 2. Simulate Stripe Webhook: checkout.session.completed
    webhook_event = {
        "id": "evt_test_webhook_12345",
        "type": "checkout.session.completed",
        "data": {
            "object": {
                "id": session_id,
                "payment_intent": "pi_test_98765",
            }
        },
    }

    # First delivery
    wh_res1 = await client.post("/webhooks/stripe", json=webhook_event)
    assert wh_res1.status_code == 200
    assert wh_res1.json()["status"] == "success"

    # Verify order is now paid
    order_res = await client.get(f"/orders/{order_id}")
    assert order_res.json()["status"] == "paid"

    # 3. Idempotency verification: Replay the EXACT same event
    wh_res2 = await client.post("/webhooks/stripe", json=webhook_event)
    assert wh_res2.status_code == 200
    assert wh_res2.json()["status"] == "success"

    # Order remains paid, without errors
    order_res_after = await client.get(f"/orders/{order_id}")
    assert order_res_after.json()["status"] == "paid"
