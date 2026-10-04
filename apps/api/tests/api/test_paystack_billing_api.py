"""Integration tests for Paystack Mobile Money & Card checkout, webhooks, idempotency, and cancellation."""

import hashlib
import hmac
import json

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.config import get_settings
from app.db import get_db
from app.leagues.models import Enrollment, EnrollmentStatus

settings = get_settings()


def _signed_paystack_post(client: AsyncClient, path: str, payload: dict):
    raw_bytes = json.dumps(payload).encode("utf-8")
    sig = hmac.new(
        settings.PAYSTACK_SECRET_KEY.encode("utf-8"), raw_bytes, hashlib.sha512
    ).hexdigest()
    return client.post(
        path,
        content=raw_bytes,
        headers={"Content-Type": "application/json", "x-paystack-signature": sig},
    )


@pytest.mark.asyncio
async def test_paystack_checkout_session_creation(client: AsyncClient, seeded_catalog):
    """Verify that creating a checkout session creates an order in pending_payment status."""
    # 1. Register player
    reg_payload = {
        "email": "momo_user@example.com",
        "password": "Password123!",
        "display_name": "MoMo Player",
    }
    reg_res = await client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Request checkout session
    checkout_payload = {
        "program_ids": ["prog-accra-fall-2026"],
        "success_url": "tennisleague://checkout/result?session_id={CHECKOUT_SESSION_ID}",
        "cancel_url": "tennisleague://join",
    }
    res = await client.post("/checkout/sessions", json=checkout_payload, headers=headers)
    assert res.status_code == 200
    data = res.json()
    assert "order_id" in data
    assert "session_id" in data
    assert "checkout_url" in data

    order_id = data["order_id"]

    # 3. Check order is initially pending_payment
    order_res = await client.get(f"/orders/{order_id}", headers=headers)
    assert order_res.status_code == 200
    order_data = order_res.json()
    assert order_data["status"] == "pending_payment"
    assert order_data["total_cents"] == 35000
    assert order_data["currency"] == "GHS"


@pytest.mark.asyncio
async def test_paystack_charge_success_creates_exactly_one_enrollment(
    client: AsyncClient, seeded_catalog
):
    """Verify that charge.success fulfills the order and creates exactly 1 active enrollment."""
    # 1. Register player
    reg_payload = {
        "email": "success_user@example.com",
        "password": "Password123!",
        "display_name": "Success Player",
    }
    reg_res = await client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create order
    checkout_payload = {
        "program_ids": ["prog-accra-fall-2026"],
        "success_url": "tennisleague://checkout/result?session_id={CHECKOUT_SESSION_ID}",
    }
    res = await client.post("/checkout/sessions", json=checkout_payload, headers=headers)
    order_id = res.json()["order_id"]

    order_res = await client.get(f"/orders/{order_id}", headers=headers)
    user_id = order_res.json()["user_id"]

    # 3. Deliver Paystack webhook: charge.success (MTN MoMo payment)
    webhook_event = {
        "event": "charge.success",
        "data": {
            "id": 99001122,
            "status": "success",
            "reference": order_id,
            "amount": 35000,
            "channel": "mobile_money",
            "currency": "GHS",
            "gateway_response": "Successful MTN Mobile Money",
            "metadata": {
                "order_id": order_id,
                "user_id": user_id,
            },
        },
    }

    wh_res = await _signed_paystack_post(client, "/webhooks/paystack", webhook_event)
    assert wh_res.status_code == 200
    assert wh_res.json()["status"] == "success"

    # 4. Verify order state is now paid
    order_res_after = await client.get(f"/orders/{order_id}", headers=headers)
    assert order_res_after.json()["status"] == "paid"

    # 5. Verify exactly 1 active enrollment was created in the database
    db_gen = client._transport.app.dependency_overrides.get(get_db, get_db)()
    session = await anext(db_gen)
    try:
        stmt = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.program_id == "prog-accra-fall-2026",
        )
        enrollments = (await session.execute(stmt)).scalars().all()
        assert len(enrollments) == 1
        assert enrollments[0].status == EnrollmentStatus.ACTIVE
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_paystack_webhook_idempotency_on_replay(client: AsyncClient, seeded_catalog):
    """Verify that replaying a Paystack webhook event is idempotent and creates NO duplicate enrollments."""
    # 1. Register player
    reg_payload = {
        "email": "replay_user@example.com",
        "password": "Password123!",
        "display_name": "Replay Player",
    }
    reg_res = await client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create order
    checkout_payload = {
        "program_ids": ["prog-accra-fall-2026"],
        "success_url": "tennisleague://checkout/result?session_id={CHECKOUT_SESSION_ID}",
    }
    res = await client.post("/checkout/sessions", json=checkout_payload, headers=headers)
    order_id = res.json()["order_id"]

    order_res = await client.get(f"/orders/{order_id}", headers=headers)
    user_id = order_res.json()["user_id"]

    # 3. Simulate first webhook delivery
    webhook_event = {
        "event": "charge.success",
        "data": {
            "id": 88112233,
            "status": "success",
            "reference": order_id,
            "amount": 35000,
            "channel": "mobile_money",
            "currency": "GHS",
            "gateway_response": "Approved",
            "metadata": {
                "order_id": order_id,
                "user_id": user_id,
            },
        },
    }

    res1 = await _signed_paystack_post(client, "/webhooks/paystack", webhook_event)
    assert res1.status_code == 200
    assert res1.json()["status"] == "success"

    # Verify order is paid
    order_res_paid = await client.get(f"/orders/{order_id}", headers=headers)
    assert order_res_paid.json()["status"] == "paid"

    # Confirm database has strictly 1 enrollment
    db_gen = client._transport.app.dependency_overrides.get(get_db, get_db)()
    session = await anext(db_gen)
    try:
        stmt = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.program_id == "prog-accra-fall-2026",
        )
        enrollments = (await session.execute(stmt)).scalars().all()
        assert len(enrollments) == 1
    finally:
        await session.close()

    # 4. Replay EXACT same webhook (network duplicate or retry)
    res2 = await _signed_paystack_post(client, "/webhooks/paystack", webhook_event)
    assert res2.status_code == 200
    assert res2.json()["status"] == "success"

    # 5. Replay third time to be absolutely certain
    res3 = await _signed_paystack_post(client, "/webhooks/paystack", webhook_event)
    assert res3.status_code == 200

    # Check order is still paid
    order_res_after = await client.get(f"/orders/{order_id}", headers=headers)
    assert order_res_after.json()["status"] == "paid"

    # Confirm database has still strictly 1 enrollment
    db_gen = client._transport.app.dependency_overrides.get(get_db, get_db)()
    session = await anext(db_gen)
    try:
        stmt = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.program_id == "prog-accra-fall-2026",
        )
        enrollments = (await session.execute(stmt)).scalars().all()
        assert len(enrollments) == 1
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_paystack_charge_failed_marks_order_cancelled_with_no_enrollment(
    client: AsyncClient, seeded_catalog
):
    """Verify that charge.failed marks the order CANCELLED (not stuck in PENDING_PAYMENT) and creates 0 enrollments."""
    # 1. Register player
    reg_payload = {
        "email": "failed_pay_user@example.com",
        "password": "Password123!",
        "display_name": "Failed Payment Player",
    }
    reg_res = await client.post("/auth/register", json=reg_payload)
    assert reg_res.status_code == 201
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Create order
    checkout_payload = {
        "program_ids": ["prog-accra-fall-2026"],
        "success_url": "tennisleague://checkout/result?session_id={CHECKOUT_SESSION_ID}",
    }
    res = await client.post("/checkout/sessions", json=checkout_payload, headers=headers)
    order_id = res.json()["order_id"]

    # Order is pending initially
    order_res_before = await client.get(f"/orders/{order_id}", headers=headers)
    assert order_res_before.json()["status"] == "pending_payment"
    user_id = order_res_before.json()["user_id"]

    # 3. Simulate failed MoMo transaction (e.g. user cancelled prompt or insufficient balance)
    webhook_event = {
        "event": "charge.failed",
        "data": {
            "id": 77665544,
            "status": "failed",
            "reference": order_id,
            "amount": 35000,
            "channel": "mobile_money",
            "currency": "GHS",
            "gateway_response": "Declined - Insufficient Funds",
        },
    }

    wh_res = await _signed_paystack_post(client, "/webhooks/paystack", webhook_event)
    assert wh_res.status_code == 200

    # 4. Verify order is now CANCELLED (not stuck in pending_payment!)
    order_res_after = await client.get(f"/orders/{order_id}", headers=headers)
    assert order_res_after.json()["status"] == "cancelled"

    # 5. Verify NO enrollments were created
    db_gen = client._transport.app.dependency_overrides.get(get_db, get_db)()
    session = await anext(db_gen)
    try:
        stmt = select(Enrollment).where(
            Enrollment.user_id == user_id,
            Enrollment.program_id == "prog-accra-fall-2026",
        )
        enrollments = (await session.execute(stmt)).scalars().all()
        assert len(enrollments) == 0
    finally:
        await session.close()


@pytest.mark.asyncio
async def test_paystack_hmac_signature_verification(client: AsyncClient):
    """Verify that x-paystack-signature header is strictly validated when provided."""
    secret = settings.PAYSTACK_SECRET_KEY
    payload = {
        "event": "charge.success",
        "data": {
            "id": 55443322,
            "status": "success",
            "reference": "dummy_ref",
            "amount": 35000,
            "currency": "GHS",
        },
    }
    raw_bytes = json.dumps(payload).encode("utf-8")

    # 1. Invalid signature should be rejected with 400
    res_bad = await client.post(
        "/webhooks/paystack",
        content=raw_bytes,
        headers={
            "Content-Type": "application/json",
            "x-paystack-signature": "invalid_signature_hex_12345",
        },
    )
    assert res_bad.status_code == 400
    assert "Invalid webhook signature" in res_bad.json()["detail"]

    # 2. Valid signature computed via HMAC SHA-512
    valid_sig = hmac.new(secret.encode("utf-8"), raw_bytes, hashlib.sha512).hexdigest()
    res_good = await client.post(
        "/webhooks/paystack",
        content=raw_bytes,
        headers={
            "Content-Type": "application/json",
            "x-paystack-signature": valid_sig,
        },
    )
    # The signature passed, even if dummy_ref is not found
    assert res_good.status_code == 200
