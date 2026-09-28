# Tennis League Platform — Production Audit Report
**Date:** 28 September 2026  
**Auditor:** Antigravity  
**Scope:** Full codebase review against ADR handbook, Non-negotiable Rules, and production-readiness standards.

---

## Executive Summary

The platform is in a **strong MVP state** with a well-structured modular monolith, clean domain separation, solid test coverage (71 tests passing), and zero type errors on both backend and frontend. The majority of ADR requirements have been implemented correctly. There are **8 flagged issues** — none are immediate blockers for staging, but **3 are critical-priority before production launch**.

---

## ✅ Phase Completion Checklist

### Phase 1 — Project Foundation & Architecture
- [x] Modular monolith structure (`apps/api`, `apps/mobile`) — ADR 0001 ✅
- [x] Expo + Expo Router universal client — ADR 0002 ✅
- [x] PostgreSQL + Procrastinate job queue configured — ADR 0003 ✅
- [x] `pyproject.toml` with `uv` package manager ✅
- [x] Root `README.md` with quickstart and architecture docs ✅
- [x] `.env.example` with all required variables ✅
- [x] `.gitignore` configured ✅

### Phase 2 — Domain Layer & Business Rules
- [x] Pure domain functions in `apps/api/app/domain/` — zero FastAPI/SQLAlchemy imports ✅
- [x] `domain/scoring.py` — match format validation, set scores, tiebreak rules ✅
- [x] `domain/standings.py` — `compute_standings()` with tie-breaking rules ✅
- [x] `domain/discipline.py` — strike evaluation, rematch eligibility ✅
- [x] `domain/pricing.py` — integer cents, tier rules, credit application ✅
- [x] `domain/brackets.py` — single-elimination playoff bracket engine ✅
- [x] `domain/partners.py` — partner credit logic ✅
- [x] `domain/jobs.py` — job payload definitions ✅
- [x] All domain rule constants sourced from `Settings` — ADR configurable policies ✅
- [x] 71 unit tests passing — pure domain functions fully tested ✅

### Phase 3 — Data Models & Migrations
- [x] SQLAlchemy 2 async models for all 14 system entities ✅
- [x] `User`, `PlayerProfile`, `Market`, `Program`, `Division`, `Enrollment` ✅
- [x] `Match`, `MatchDispute`, `Strike`, `AuditLog` ✅
- [x] `Order`, `OrderItem`, `CreditModel`, `ProcessedWebhookEvent` ✅
- [x] `Court`, `PlayoffBracket`, `UserDevice`, `NotificationLog` ✅
- [x] `market_id` foreign key on all tenant-scoped tables ✅
- [x] Alembic configured (`alembic.ini` present) ✅
- [ ] ⚠️ No migration files present — `alembic/versions/` appears empty (see Issue #1)

### Phase 4 — Identity & Authentication
- [x] `POST /auth/register`, `POST /auth/login` — Argon2 password hashing ✅
- [x] JWT access tokens (15 min) + refresh token rotation (30 day) ✅
- [x] `GET /me`, `PATCH /me/profile` — profile management ✅
- [x] `DELETE /me` — GDPR account deletion + anonymization ✅
- [x] `GET /me/communication-settings`, `PUT /me/communication-settings` ✅
- [x] `get_current_user` FastAPI dependency (Bearer JWT validation) ✅
- [x] `get_current_admin_user` dependency (role-gated) ✅

### Phase 5 — Billing & Payments
- [x] `POST /cart/quote` — server-side pricing quote ✅
- [x] `POST /checkout/sessions` — creates pending order ✅
- [x] `POST /webhooks/stripe` — idempotent event processing via `ProcessedWebhookEvent` ✅
- [x] `GET /orders/{id}` — order status polling ✅
- [x] Integer cents enforced throughout — ADR 0004 ✅
- [x] Credit model with `is_consumed` flag, idempotent consumption ✅
- [ ] ⚠️ **CRITICAL:** Stripe webhook signature not verified (see Issue #2)
- [ ] ⚠️ Real Stripe session creation uses mock `uuid4` (see Issue #3)

### Phase 6 — Match Reporting & Score Verification
- [x] `POST /matches` — submit match score with domain validation ✅
- [x] `POST /matches/{id}/confirm` — opponent confirmation ✅
- [x] `POST /matches/{id}/dispute` — 24h cooling-off dispute window ✅
- [x] Contact gating enforced in `/divisions/{id}/roster` ✅
- [x] Auto-confirm after 48h (`auto_confirm_match_hours`) ✅
- [x] Audit log written on every match mutation ✅
- [x] Rematch limit enforcement (`max_wins_vs_opponent`) ✅

### Phase 7 — Standings & Playoffs
- [x] `GET /divisions/{id}/standings` — computed from pure domain engine ✅
- [x] Playoff eligibility indicators ✅
- [x] Playoff bracket generation — `domain/brackets.py` ✅
- [x] `POST /playoffs/brackets/draw`, `POST /playoffs/brackets/{id}/advance` ✅

### Phase 8 — Community, Courts & Partners
- [x] Court model with surface, lighting, indoor, booking URL ✅
- [x] `GET /community/courts` — filterable court directory ✅
- [x] `GET /community/partners` — partner venue listing ✅
- [x] `GET /community/poty` — Player of the Year nominations ✅
- [x] Partner credit program in domain layer ✅

### Phase 9 — Push Notifications & Background Jobs
- [x] Procrastinate async job queue configured — ADR 0003/0012 ✅
- [x] `app/jobs.py` — Procrastinate app with PostgreSQL backend ✅
- [x] `domain/jobs.py` — job payloads for kickoff, reminder, result notifications ✅
- [x] Expo Push API URL configured in `Settings` ✅
- [x] Email provider abstraction (`console`/`resend`/`ses`) ✅

### Phase 10 — Admin Back Office
- [x] SQLAdmin mounted at `/admin` — ADR 0014 ✅
- [x] `AdminAuth` with role-based gate (`market_admin`, `super_admin`) ✅
- [x] 14 model views configured with search/filter/read-only protections ✅
- [x] Custom admin action endpoints (`admin_actions/`) ✅
- [x] `AuditLogAdmin` — immutable (`can_create=False`, `can_edit=False`, `can_delete=False`) ✅
- [x] `NotificationLogAdmin` — read-only ✅

### Phase 11 — Client UI & Design
- [x] Dashboard HomeScreen with hero Next Match card ✅
- [x] Tennis ball image backdrop with fading white gradient overlay ✅
- [x] Light mode forced by default (`activeThemeMode = "light"`) ✅
- [x] System fonts (`system-ui`, SF, Roboto) via `tokens.ts` ✅
- [x] Feather icon font properly loaded and protected from CSS override ✅
- [x] Division screen, Programs screen, Scores screen ✅
- [x] Courts directory, Partners screen, Community/POTY screen ✅
- [x] Account, settings/notifications, delete-account screens ✅
- [x] Checkout/join/result screens ✅
- [x] `StandingsTable` — desktop table + mobile card list mode ✅
- [x] `OfflineBanner` — 24h `gcTime`, `networkMode: offlineFirst` ✅
- [x] `AccessibleButton`, `formatScoreForScreenReader()` — ADR 0013 ✅

### Phase 12 — Infrastructure & Deployment
- [x] `infra/docker-compose.prod.yml` — PostgreSQL 16 + FastAPI + Worker + Caddy ✅
- [x] `infra/caddy/Caddyfile` — TLS, HSTS, security headers, rate limiting ✅
- [x] `apps/api/Dockerfile` present ✅
- [x] Worker service for Procrastinate background jobs ✅

### Phase 13 — Compliance & Documentation
- [x] `docs/privacy-data-inventory.md` — GDPR Article 6/17 mapping ✅
- [x] `docs/store-compliance.md` — Apple 3.1.5(a) + Google Play justification ✅
- [x] 13 ADR documents in `docs/adr/` ✅
- [x] GDPR `delete_and_anonymize_user()` endpoint ✅
- [x] Contact gating (Rule 5) enforced at roster endpoint ✅

---

## 🔴 Critical Issues (Must Fix Before Production)

### Issue #1 — Alembic Migrations Missing
**File:** `apps/api/`  
**Severity:** 🔴 Critical  
**Description:** There are no migration files in `alembic/versions/`. The app auto-creates tables only for SQLite (`if "sqlite" in settings.DATABASE_URL`). On a real PostgreSQL production database, **there is no automated schema creation** — the database will be empty and every API call will fail with a relation-does-not-exist error.  
**Fix:**
```bash
cd apps/api
uv run alembic revision --autogenerate -m "initial_schema"
uv run alembic upgrade head
```
Then commit the generated migration file. Add `uv run alembic upgrade head` to the Docker entrypoint startup command.

---

### Issue #2 — Stripe Webhook Signature Not Verified  
**File:** [`apps/api/app/billing/routes.py`](file:///c:/Users/nanak/Desktop/Tennis_App/apps/api/app/billing/routes.py#L74-L107)  
**Severity:** 🔴 Critical (Security + ADR 0007 violation)  
**Description:** The `stripe_signature` header is read but **never used** to verify the request. Any actor can POST a fake `checkout.session.completed` event and fraudulently activate enrollments. ADR 0007 explicitly states: *"Payment confirmation is strictly driven by server-to-server Stripe webhooks, verified using Stripe's cryptographic signature."*  
**Fix:**
```python
import stripe
from fastapi import HTTPException

payload_bytes = await request.body()
try:
    event = stripe.Webhook.construct_event(
        payload_bytes, stripe_signature, settings.STRIPE_WEBHOOK_SECRET
    )
except stripe.error.SignatureVerificationError:
    raise HTTPException(status_code=400, detail="Invalid Stripe signature")

event_id = event["id"]
event_type = event["type"]
```

---

### Issue #3 — Stripe Checkout Session Uses Mock UUID (Not Real Stripe)
**File:** [`apps/api/app/billing/service.py`](file:///c:/Users/nanak/Desktop/Tennis_App/apps/api/app/billing/service.py#L110-L117)  
**Severity:** 🔴 Critical (Payments don't work)  
**Description:** `create_checkout_order()` generates `cs_test_{uuid.uuid4()}` locally and never calls `stripe.checkout.Session.create()`. The `checkout_url` points to `success_url` directly — no real Stripe Checkout page is opened.  
**Fix:** Integrate the real Stripe SDK:
```python
import stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

session_obj = stripe.checkout.Session.create(
    payment_method_types=["card"],
    line_items=[...],
    mode="payment",
    success_url=req.success_url,
    cancel_url=req.cancel_url,
    client_reference_id=order.id,
    metadata={"order_id": order.id, "market_id": market_id},
)
session_id = session_obj.id
checkout_url = session_obj.url
```

---

## 🟡 High-Priority Issues (Fix Before App Store Submission)

### Issue #4 — `DEBUG=True` Default in `config.py`
**File:** [`apps/api/app/config.py`](file:///c:/Users/nanak/Desktop/Tennis_App/apps/api/app/config.py#L17)  
**Severity:** 🟡 High  
**Description:** `DEBUG: bool = True` is the default setting. In production, this enables detailed Python tracebacks in API error responses (leaks internal paths, SQL, and stack traces).  
**Fix:** Change default to `False` and validate in production:
```python
DEBUG: bool = False
```
Add a startup validation guard:
```python
if settings.ENVIRONMENT == "production" and settings.DEBUG:
    raise RuntimeError("DEBUG must be False in production.")
```

---

### Issue #5 — Hardcoded `SECRET_KEY` Default  
**File:** [`apps/api/app/config.py`](file:///c:/Users/nanak/Desktop/Tennis_App/apps/api/app/config.py#L29)  
**Severity:** 🟡 High  
**Description:** `SECRET_KEY: str = "dev-insecure-secret-key-change-in-production-min-32-chars"` — if someone deploys without setting this env var, all JWTs will be signed with a publicly known key.  
**Fix:** Validate at startup:
```python
@model_validator(mode="after")
def validate_production_secrets(self) -> "Settings":
    if self.ENVIRONMENT == "production":
        if "insecure" in self.SECRET_KEY or len(self.SECRET_KEY) < 32:
            raise ValueError("SECRET_KEY must be a secure random string in production.")
    return self
```

---

### Issue #6 — CORS Allows All Methods and Headers in Production
**File:** [`apps/api/app/main.py`](file:///c:/Users/nanak/Desktop/Tennis_App/apps/api/app/main.py#L57-L63)  
**Severity:** 🟡 High  
**Description:** `allow_methods=["*"]` and `allow_headers=["*"]` are overly permissive. In production, CORS should be restricted to the actual HTTP methods and headers the client uses.  
**Fix:**
```python
allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allow_headers=["Authorization", "Content-Type", "X-Request-ID"],
```

---

### Issue #7 — Mock Winner/Loser Names in Match Response
**File:** [`apps/api/app/matches/routes.py`](file:///c:/Users/nanak/Desktop/Tennis_App/apps/api/app/matches/routes.py#L40-L44)  
**Severity:** 🟡 High  
**Description:** `MatchResponse` hardcodes `winner_name="Winner"` and `loser_name="Opponent"` instead of reading from the database. Clients display these names in score feeds and notifications.  
**Fix:** Join `PlayerProfile` in the service layer and return real names. The `get_latest_scores_feed()` already does this correctly — the `submit_match` response needs the same join.

---

## 🟢 Medium Issues (Improve for Production Quality)

### Issue #8 — `version: "3.9"` in `docker-compose.prod.yml` is Deprecated
**File:** [`infra/docker-compose.prod.yml`](file:///c:/Users/nanak/Desktop/Tennis_App/infra/docker-compose.prod.yml#L1)  
**Severity:** 🟢 Medium  
**Description:** The `version:` field is deprecated in Docker Compose v2. Removing it silences the warning and future-proofs the file.  
**Fix:** Delete line 1 (`version: "3.9"`).

---

### Issue #9 — No Rate Limiting on Auth Endpoints  
**File:** `apps/api/app/identity/routes.py`  
**Severity:** 🟢 Medium  
**Description:** `POST /auth/login` and `POST /auth/register` have no rate limiting at the application level. The Caddy config provides no explicit rate limit on these paths. Brute force attacks on credentials are possible.  
**Fix:** Add `slowapi` or rely on Caddy's `rate_limit` directive specifically for `/auth/*` endpoints.

---

### Issue #10 — `fontsLoaded` Guard Missing in `_layout.tsx`
**File:** [`apps/mobile/app/_layout.tsx`](file:///c:/Users/nanak/Desktop/Tennis_App/apps/mobile/app/_layout.tsx#L64)  
**Severity:** 🟢 Medium  
**Description:** `useFonts(Feather.font)` is called but `fontsLoaded` is never checked — if the font hasn't loaded yet, there's a brief flash of missing glyphs before icons appear.  
**Fix:**
```tsx
const [fontsLoaded] = useFonts(Feather.font);
if (!fontsLoaded) return null; // or a splash/skeleton screen
```

---

### Issue #11 — No `LOG_LEVEL` / Structured Logging in API
**Severity:** 🟢 Medium  
**Description:** `.env.example` includes `LOG_LEVEL=info` and `SENTRY_DSN=` but neither is wired into `config.py` or `main.py`. Production requires structured JSON logs and Sentry error capture.  
**Fix:** Add `LOG_LEVEL` and `SENTRY_DSN` to `Settings`, add `sentry-sdk[fastapi]` to `pyproject.toml`, and initialise Sentry in `main.py` lifespan.

---

## 📋 ADR Compliance Gap Analysis

| ADR | Title | Status | Gap |
|-----|-------|--------|-----|
| 0001 | Modular Monolith | ✅ Full | — |
| 0002 | Expo All Platforms | ✅ Full | — |
| 0003 | PostgreSQL Job Queue | ✅ Full | Worker configured in docker-compose |
| 0004 | Financial & Time Precision | ✅ Full | Integer cents; UTC storage |
| 0006 | Token Strategy | ✅ Full | JWT + refresh rotation |
| 0007 | Stripe Idempotent Webhooks | ⚠️ Partial | Idempotency table ✅, **signature verification missing** |
| 0008 | Anonymize Historical Results | ✅ Full | `delete_and_anonymize_user()` ✅ |
| 0009 | Score Verification & Contact Gating | ✅ Full | Cooling-off, confirmation, gating ✅ |
| 0010 | Single-Elimination Playoffs | ✅ Full | Bracket engine + routes ✅ |
| 0011 | Partner Program & Courts | ✅ Full | Court model + partner credits ✅ |
| 0012 | Background Jobs & Notifications | ✅ Full | Procrastinate + Expo push ✅ |
| 0013 | Cross-Platform Polish & A11y | ✅ Full | Tokens, `formatScoreForScreenReader`, `AccessibleButton`, offline cache ✅ |
| 0014 | Admin Back Office & Launch Readiness | ✅ Full | SQLAdmin 14 views, custom workflows, infra ✅ |

---

## 🚀 Production Readiness Checklist

### Infrastructure
- [x] Docker Compose production stack ✅
- [x] Caddy TLS + security headers ✅
- [x] PostgreSQL 16 with health checks ✅
- [x] Procrastinate background worker ✅
- [ ] ❌ Run Alembic migrations in Docker entrypoint
- [ ] ❌ Sentry DSN configured and wired
- [ ] ❌ Real Stripe integration (not mock)

### Security
- [x] Argon2 password hashing ✅
- [x] JWT with short expiry (15 min) ✅
- [x] Refresh token rotation ✅
- [x] Admin role RBAC ✅
- [x] HSTS, X-Frame-Options, CSP via Caddy ✅
- [ ] ❌ Stripe signature verification on webhooks
- [ ] ❌ `DEBUG=False` in production
- [ ] ❌ Secret key validation at startup
- [ ] ❌ Auth endpoint rate limiting

### App Store
- [x] `DELETE /me` — Apple account deletion requirement ✅
- [x] Apple 3.1.5(a) physical services Stripe exemption documented ✅
- [x] GDPR anonymization implemented ✅
- [x] `docs/privacy-data-inventory.md` ✅

### Observability
- [ ] ❌ Structured JSON logging
- [ ] ❌ Sentry error tracking
- [ ] ❌ Health check includes DB connectivity test

### Testing
- [x] 71 backend unit tests passing ✅
- [x] TypeScript: 0 type errors ✅
- [x] mypy: 0 issues (45 source files) ✅
- [x] ruff: All checks passed ✅

---

## Summary Score

| Category | Score |
|----------|-------|
| Architecture & Domain | 10/10 |
| API Correctness | 8/10 |
| Security | 5/10 |
| Payments | 4/10 |
| UI/UX | 9/10 |
| Infrastructure | 8/10 |
| Compliance & Docs | 10/10 |
| **Overall** | **7.7/10** |

> The platform is **production-ready in architecture** but needs Issues #1, #2, and #3 resolved before it can safely handle real money and real users.
