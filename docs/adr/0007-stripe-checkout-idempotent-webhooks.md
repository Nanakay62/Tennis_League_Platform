# ADR 0007: Stripe Checkout and Idempotent Webhook Fulfillment

## Status
Accepted

## Context
Payment processing for sports leagues requires high reliability. Network interruptions, browser crashes, and Stripe webhook retries can lead to duplicate charges, multiple enrollments, or missed activations. Furthermore, Apple App Store Guideline 3.1.5(a) allows real-world physical services and sports league registrations to use direct external payment processors like Stripe.

## Decision
1. **Hosted Checkout:** We use **Stripe Checkout** (`POST /checkout/sessions`) rather than custom in-app credit card forms. This reduces PCI compliance scope to SAQ-A and ensures seamless Apple Pay and Google Pay support on both web and native devices.
2. **Never Trust Redirects Alone:** Payment confirmation is strictly driven by server-to-server Stripe webhooks (`POST /webhooks/stripe`), verified using Stripe's cryptographic signature (`stripe_signature`).
3. **Idempotency Tracking:** Every webhook event is checked against the `processed_webhook_events` database table. If an event ID has already been recorded, the webhook returns `HTTP 200` immediately with no duplicated enrollments, credit consumption, or audit logs.
4. **Immediate Client Feedback:** The client polls `GET /orders/{id}` on the checkout result screen until the order transitions to `paid`.

## Consequences
- **Positive:** Zero duplicate enrollments; PCI compliance is minimized; resilient against duplicate webhook deliveries and network disconnects.
- **Negative:** Local testing requires running Stripe CLI or mock event dispatchers to trigger webhook delivery.
