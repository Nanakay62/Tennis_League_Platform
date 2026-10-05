"""Dedicated verification tests for Step 1 (Payment-fraud chain B1, B2, B3)
and Step 2 (Billing robustness: 502 on Paystack failure, terminal enrollment, credit lock).
"""

import hashlib
import hmac
import json
from unittest.mock import AsyncMock, patch

import pytest
from httpx import AsyncClient
from sqlalchemy import select

from app.billing.models import CreditModel
from app.config import get_settings
from app.domain.pricing import CreditType
from app.identity.models import User
from app.leagues.models import Enrollment, EnrollmentStatus
from app.matches.models import AuditLog

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
async def test_order_status_authentication_and_scoping_b3(client: AsyncClient, seeded_catalog):
    """B3: GET /orders/{id} must require authentication and scope to owning user only."""
    # 1. Register User A and create an order
    res_a = await client.post(
        "/auth/register",
        json={"email": "order_a@example.com", "password": "Password123!", "display_name": "User A"},
    )
    assert res_a.status_code == 201
    token_a = res_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    sess_res = await client.post(
        "/checkout/sessions",
        headers=headers_a,
        json={
            "program_ids": ["prog-accra-fall-2026"],
            "success_url": "tennisleague://checkout/result?session_id={CHECKOUT_SESSION_ID}",
        },
    )
    assert sess_res.status_code == 200
    order_id = sess_res.json()["order_id"]

    # 2. Register User B
    res_b = await client.post(
        "/auth/register",
        json={"email": "order_b@example.com", "password": "Password123!", "display_name": "User B"},
    )
    assert res_b.status_code == 201
    token_b = res_b.json()["access_token"]
    headers_b = {"Authorization": f"Bearer {token_b}"}

    # Unauthenticated request -> 401
    unauth_res = await client.get(f"/orders/{order_id}")
    assert unauth_res.status_code == 401

    # Non-owning request (User B accessing User A's order) -> 404
    non_owner_res = await client.get(f"/orders/{order_id}", headers=headers_b)
    assert non_owner_res.status_code == 404

    # Owning request (User A) -> 200
    owner_res = await client.get(f"/orders/{order_id}", headers=headers_a)
    assert owner_res.status_code == 200
    assert owner_res.json()["id"] == order_id


@pytest.mark.asyncio
async def test_webhook_signature_strictly_enforced_b2(client: AsyncClient):
    """B2: Webhook signature verification unconditionally enforced; unsigned rejected with 400."""
    payload = {"event": "charge.success", "data": {"id": 1, "reference": "ref1", "amount": 35000}}

    # Completely unsigned request
    unsigned_res = await client.post("/webhooks/paystack", json=payload)
    assert unsigned_res.status_code == 400
    assert "Missing x-paystack-signature header" in unsigned_res.json()["detail"]

    # Invalid signature
    bad_sig_res = await client.post(
        "/webhooks/paystack",
        json=payload,
        headers={"x-paystack-signature": "bogus_signature_123"},
    )
    assert bad_sig_res.status_code == 400
    assert "Invalid webhook signature" in bad_sig_res.json()["detail"]


@pytest.mark.asyncio
async def test_checkout_validation_checks_b1(client: AsyncClient, seeded_catalog):
    """B1 & Decision 2: Checkout validates program existence, non-empty cart, city match, and deduplication."""
    # Register Accra player
    reg_accra = await client.post(
        "/auth/register",
        json={
            "email": "accra_buyer@example.com",
            "password": "Password123!",
            "display_name": "Accra Buyer",
            "home_area": "Accra",
        },
    )
    assert reg_accra.status_code == 201
    headers_accra = {"Authorization": f"Bearer {reg_accra.json()['access_token']}"}

    # 1. Nonexistent program -> 400 (never invent price)
    bad_prog_res = await client.post(
        "/checkout/sessions",
        headers=headers_accra,
        json={"program_ids": ["prog-phantom-999"], "success_url": "tennisleague://success"},
    )
    assert bad_prog_res.status_code == 400
    assert "Unknown program(s)" in bad_prog_res.json()["detail"]

    # 2. Empty cart -> 400 or 422 (validation error)
    empty_cart_res = await client.post(
        "/checkout/sessions",
        headers=headers_accra,
        json={"program_ids": [], "success_url": "tennisleague://success"},
    )
    if empty_cart_res.status_code == 400:
        assert "Cart cannot be empty" in empty_cart_res.json()["detail"]
    else:
        assert empty_cart_res.status_code == 422

    # 3. Duplicate programs in cart -> deduplicated, status 200 with 1 item
    dup_cart_res = await client.post(
        "/checkout/sessions",
        headers=headers_accra,
        json={
            "program_ids": ["prog-accra-fall-2026", "prog-accra-fall-2026"],
            "success_url": "tennisleague://success",
        },
    )
    assert dup_cart_res.status_code == 200
    order_res = await client.get(
        f"/orders/{dup_cart_res.json()['order_id']}",
        headers=headers_accra,
    )
    assert order_res.status_code == 200
    assert len(order_res.json()["items"]) == 1

    # 4. City mismatch: Accra player trying to buy Tema program -> 400
    mismatch_res = await client.post(
        "/checkout/sessions",
        headers=headers_accra,
        json={
            "program_ids": ["prog-tema-fall-2026"],
            "success_url": "tennisleague://success",
        },
    )
    assert mismatch_res.status_code == 400
    assert "does not match your home playing area" in mismatch_res.json()["detail"]


@pytest.mark.asyncio
async def test_duplicate_active_enrollment_rejected_at_checkout(
    client: AsyncClient, seeded_catalog
):
    """User already actively enrolled in program cannot checkout again for the same program."""
    reg = await client.post(
        "/auth/register",
        json={
            "email": "active_buyer@example.com",
            "password": "Password123!",
            "display_name": "Active Buyer",
        },
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # 1. Checkout and fulfill order
    order_res = await client.post(
        "/checkout/sessions",
        headers=headers,
        json={"program_ids": ["prog-accra-fall-2026"], "success_url": "tennisleague://success"},
    )
    order_id = order_res.json()["order_id"]
    order_detail = await client.get(f"/orders/{order_id}", headers=headers)
    user_id = order_detail.json()["user_id"]

    wh_event = {
        "event": "charge.success",
        "data": {
            "id": 1234,
            "reference": order_id,
            "amount": 35000,
            "currency": "GHS",
            "metadata": {"order_id": order_id, "user_id": user_id},
        },
    }
    await _signed_paystack_post(client, "/webhooks/paystack", wh_event)

    # 2. Attempt checking out again for the same program -> 400
    second_res = await client.post(
        "/checkout/sessions",
        headers=headers,
        json={"program_ids": ["prog-accra-fall-2026"], "success_url": "tennisleague://success"},
    )
    assert second_res.status_code == 400
    assert "already have an active enrollment" in second_res.json()["detail"]


@pytest.mark.asyncio
async def test_webhook_amount_mismatch_blocks_fulfillment(client: AsyncClient, seeded_catalog):
    """Webhook with paid amount less or greater than order total leaves order pending."""
    reg = await client.post(
        "/auth/register",
        json={
            "email": "underpay@example.com",
            "password": "Password123!",
            "display_name": "Underpay User",
        },
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    order_res = await client.post(
        "/checkout/sessions",
        headers=headers,
        json={"program_ids": ["prog-accra-fall-2026"], "success_url": "tennisleague://success"},
    )
    order_id = order_res.json()["order_id"]
    order_detail = await client.get(f"/orders/{order_id}", headers=headers)
    user_id = order_detail.json()["user_id"]

    # Underpayment: paid 100 GHS (10000 cents) instead of 35000 cents
    wh_event = {
        "event": "charge.success",
        "data": {
            "id": 9999,
            "reference": order_id,
            "amount": 10000,
            "currency": "GHS",
            "metadata": {"order_id": order_id, "user_id": user_id},
        },
    }
    res = await _signed_paystack_post(client, "/webhooks/paystack", wh_event)
    assert res.status_code == 200

    # Order must NOT be marked paid
    check_order = await client.get(f"/orders/{order_id}", headers=headers)
    assert check_order.json()["status"] == "pending_payment"


@pytest.mark.asyncio
async def test_paystack_init_failure_returns_502(client: AsyncClient, seeded_catalog, monkeypatch):
    """Step 2: Paystack initialization failure returns 502 Bad Gateway (never redirects to success)."""
    reg = await client.post(
        "/auth/register",
        json={
            "email": "paystack_fail@example.com",
            "password": "Password123!",
            "display_name": "Paystack Fail",
        },
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    # Configure real Paystack mode
    monkeypatch.setattr(settings, "PAYSTACK_SECRET_KEY", "sk_live_real_key_for_testing")

    mock_inst = AsyncMock()
    mock_resp = AsyncMock()
    mock_resp.status_code = 500
    mock_resp.json.return_value = {"status": False, "message": "Paystack internal gateway error"}
    mock_inst.post.return_value = mock_resp
    mock_inst.__aenter__.return_value = mock_inst
    mock_inst.__aexit__.return_value = None

    with patch("app.billing.service.httpx.AsyncClient", return_value=mock_inst):
        res = await client.post(
            "/checkout/sessions",
            headers=headers,
            json={"program_ids": ["prog-accra-fall-2026"], "success_url": "tennisleague://success"},
        )
        assert res.status_code == 502
        assert "Payment provider unavailable" in res.json()["detail"]


@pytest.mark.asyncio
async def test_terminal_enrollment_reactivation_blocked(
    client: AsyncClient, seeded_catalog, db_session
):
    """Step 2: Terminal enrollment (REMOVED, REFUNDED) cannot be reactivated by subsequent webhook."""
    reg = await client.post(
        "/auth/register",
        json={
            "email": "terminal_user@example.com",
            "password": "Password123!",
            "display_name": "Terminal User",
        },
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    order_res = await client.post(
        "/checkout/sessions",
        headers=headers,
        json={"program_ids": ["prog-accra-fall-2026"], "success_url": "tennisleague://success"},
    )
    order_id = order_res.json()["order_id"]
    order_detail = await client.get(f"/orders/{order_id}", headers=headers)
    user_id = order_detail.json()["user_id"]

    # Fulfill initial order
    wh_event = {
        "event": "charge.success",
        "data": {
            "id": 1111,
            "reference": order_id,
            "amount": 35000,
            "currency": "GHS",
            "metadata": {"order_id": order_id, "user_id": user_id},
        },
    }
    await _signed_paystack_post(client, "/webhooks/paystack", wh_event)

    # Manually transition enrollment to terminal REFUNDED status
    stmt = select(Enrollment).where(
        Enrollment.user_id == user_id,
        Enrollment.program_id == "prog-accra-fall-2026",
    )
    enr = (await db_session.execute(stmt)).scalar_one()
    enr.status = EnrollmentStatus.REFUNDED
    await db_session.commit()

    # Create second order for same program directly in DB to simulate replay or legacy order
    from app.billing.models import Order, OrderItem, OrderStatus

    second_order = Order(
        market_id=enr.market_id,
        user_id=user_id,
        status=OrderStatus.PENDING_PAYMENT,
        subtotal_cents=35000,
        total_cents=35000,
        currency="GHS",
    )
    db_session.add(second_order)
    await db_session.flush()
    db_session.add(
        OrderItem(
            order_id=second_order.id,
            program_id="prog-accra-fall-2026",
            unit_price_cents=35000,
        )
    )
    await db_session.commit()

    # Deliver second webhook for second order
    wh_event2 = {
        "event": "charge.success",
        "data": {
            "id": 2222,
            "reference": second_order.id,
            "amount": 35000,
            "currency": "GHS",
            "metadata": {"order_id": second_order.id, "user_id": user_id},
        },
    }
    await _signed_paystack_post(client, "/webhooks/paystack", wh_event2)

    # Enrollment must still be REFUNDED, NOT reactivated
    stmt_after = select(Enrollment).where(
        Enrollment.user_id == user_id,
        Enrollment.program_id == "prog-accra-fall-2026",
    )
    enr_after = (await db_session.execute(stmt_after)).scalar_one()
    assert enr_after.status == EnrollmentStatus.REFUNDED

    # Audit log should record the blocked reactivation
    audit_stmt = select(AuditLog).where(
        AuditLog.entity_id == enr.id,
        AuditLog.action == "enrollment_reactivation_blocked",
    )
    audit = (await db_session.execute(audit_stmt)).scalar_one_or_none()
    assert audit is not None


@pytest.mark.asyncio
async def test_credit_locking_across_pending_orders(
    client: AsyncClient, seeded_catalog, db_session
):
    """Step 2: Single credit cannot be applied to multiple pending orders."""
    reg = await client.post(
        "/auth/register",
        json={
            "email": "credit_lock@example.com",
            "password": "Password123!",
            "display_name": "Credit Lock",
        },
    )
    headers = {"Authorization": f"Bearer {reg.json()['access_token']}"}

    user_stmt = select(User).where(User.email == "credit_lock@example.com")
    user = (await db_session.execute(user_stmt)).scalar_one()

    # Give user a GH₵50 (5000 cents) credit
    credit = CreditModel(
        user_id=user.id,
        credit_type=CreditType.REFERRAL.value,
        amount_cents=5000,
        is_consumed=False,
    )
    db_session.add(credit)
    await db_session.commit()

    # First checkout locks the credit to Order 1
    res1 = await client.post(
        "/checkout/sessions",
        headers=headers,
        json={"program_ids": ["prog-accra-fall-2026"], "success_url": "tennisleague://success"},
    )
    assert res1.status_code == 200
    order1_id = res1.json()["order_id"]
    order1 = await client.get(f"/orders/{order1_id}", headers=headers)
    assert order1.json()["discount_cents"] == 5000
    assert order1.json()["total_cents"] == 30000

    # User registers another program or gets cart quote while Order 1 is pending
    # Cart quote must NOT apply the same credit again
    quote_res = await client.post(
        "/cart/quote",
        headers=headers,
        json={"program_ids": ["prog-accra-fall-2026"]},
    )
    assert quote_res.status_code == 200
    quote_data = quote_res.json()
    assert quote_data["discount_cents"] == 0
    assert quote_data["final_cost_cents"] == 35000


@pytest.mark.asyncio
async def test_full_exploit_chain_b1_b2_b3_blocked_end_to_end(
    client: AsyncClient, seeded_catalog, db_session
):
    """End-to-end replay of the payment fraud exploit chain (B1 -> B3 -> B2 -> Enrollment):

    Step 1: Attacker attempts to checkout with a ghost/unpriced program (B1) -> BLOCKED (400).
    Step 2: Legitimate user registers and creates a pending order for Accra Fall 2026.
    Step 3: Attacker attempts unauthenticated discovery of the order ID (B3 IDOR) -> BLOCKED (401).
    Step 4: Attacker attempts authenticated discovery from a different account (B3 Scoping) -> BLOCKED (404).
    Step 5: Attacker attempts unsigned webhook attack for the order (B2 Signature) -> BLOCKED (400).
    Step 6: Attacker attempts forged signature webhook attack (B2 Signature) -> BLOCKED (400).
    Step 7: Attacker attempts signed underpayment webhook (e.g. 1 GHS instead of 350 GHS) -> BLOCKED (order remains pending_payment).
    Step 8: Attacker verifies enrollment state -> BLOCKED (0 active enrollments granted).
    """
    # 1. Register attacker
    reg_attacker = await client.post(
        "/auth/register",
        json={
            "email": "attacker@evil.com",
            "password": "Password123!",
            "display_name": "Attacker",
            "home_area": "Accra",
        },
    )
    assert reg_attacker.status_code == 201
    attacker_headers = {"Authorization": f"Bearer {reg_attacker.json()['access_token']}"}

    # Step 1: Attacker attempts B1 exploit (checkout ghost program to get GH₵350 program for 0)
    ghost_checkout = await client.post(
        "/checkout/sessions",
        headers=attacker_headers,
        json={"program_ids": ["prog-phantom-exploit"], "success_url": "tennisleague://success"},
    )
    assert ghost_checkout.status_code == 400
    assert "Unknown program(s)" in ghost_checkout.json()["detail"]

    # Step 2: Legitimate victim registers and creates a real pending order
    reg_victim = await client.post(
        "/auth/register",
        json={
            "email": "victim@example.com",
            "password": "Password123!",
            "display_name": "Victim Player",
            "home_area": "Accra",
        },
    )
    assert reg_victim.status_code == 201
    victim_headers = {"Authorization": f"Bearer {reg_victim.json()['access_token']}"}

    legit_order_res = await client.post(
        "/checkout/sessions",
        headers=victim_headers,
        json={"program_ids": ["prog-accra-fall-2026"], "success_url": "tennisleague://success"},
    )
    assert legit_order_res.status_code == 200
    legit_order_id = legit_order_res.json()["order_id"]

    # Step 3: Attacker attempts unauthenticated discovery of order (B3 IDOR)
    unauth_order_res = await client.get(f"/orders/{legit_order_id}")
    assert unauth_order_res.status_code == 401

    # Step 4: Attacker attempts authenticated discovery from attacker account
    cross_order_res = await client.get(f"/orders/{legit_order_id}", headers=attacker_headers)
    assert cross_order_res.status_code == 404

    # Step 5: Attacker attempts unsigned webhook fulfillment (B2 bypass)
    wh_payload = {
        "event": "charge.success",
        "data": {
            "id": 8888,
            "reference": legit_order_id,
            "amount": 35000,
            "currency": "GHS",
        },
    }
    unsigned_res = await client.post("/webhooks/paystack", json=wh_payload)
    assert unsigned_res.status_code == 400
    assert "Missing x-paystack-signature header" in unsigned_res.json()["detail"]

    # Step 6: Attacker attempts forged signature webhook
    forged_sig_res = await client.post(
        "/webhooks/paystack",
        json=wh_payload,
        headers={"x-paystack-signature": "forged_sha512_hash_value"},
    )
    assert forged_sig_res.status_code == 400
    assert "Invalid webhook signature" in forged_sig_res.json()["detail"]

    # Step 7: Attacker attempts signed underpayment webhook (100 cents instead of 35000 cents)
    underpay_payload = {
        "event": "charge.success",
        "data": {
            "id": 9999,
            "reference": legit_order_id,
            "amount": 100,
            "currency": "GHS",
        },
    }
    underpay_res = await _signed_paystack_post(client, "/webhooks/paystack", underpay_payload)
    assert underpay_res.status_code == 200

    # Verify order is STILL pending_payment
    order_verify = await client.get(f"/orders/{legit_order_id}", headers=victim_headers)
    assert order_verify.json()["status"] == "pending_payment"

    # Step 8: Verify ZERO active enrollments exist for either victim or attacker from this attack
    enrollments = (
        (
            await db_session.execute(
                select(Enrollment).where(
                    Enrollment.status.in_(
                        [EnrollmentStatus.ACTIVE, EnrollmentStatus.PLACED_IN_DIVISION]
                    )
                )
            )
        )
        .scalars()
        .all()
    )
    # Filter to victim and attacker
    victim_user = (
        await db_session.execute(select(User).where(User.email == "victim@example.com"))
    ).scalar_one()
    attacker_user = (
        await db_session.execute(select(User).where(User.email == "attacker@evil.com"))
    ).scalar_one()
    bad_enrollments = [e for e in enrollments if e.user_id in (victim_user.id, attacker_user.id)]
    assert len(bad_enrollments) == 0
