---
name: tennis-league-guide
description: Project instructions, non-negotiable rules, architectural boundaries, and commands for the Tennis League Platform.
---

# Tennis League Platform — Agent Instructions

## Product
Cross-platform flex tennis league platform (web, iOS, Android).
Backend: Python 3.12+, FastAPI, SQLAlchemy 2 async, Alembic, PostgreSQL, Procrastinate.
Client: Expo + Expo Router + TypeScript (`apps/mobile`). Admin: SQLAdmin at `/admin`.
Default Market: Frankfurt (`Europe/Berlin`, `EUR`).

## Commands
- **Backend dev**: `cd apps/api && uv run fastapi dev app/main.py`
- **Backend check**: `cd apps/api && uv run ruff format --check . && uv run ruff check . && uv run mypy app && uv run pytest`
- **Database migrations**: `cd apps/api && uv run alembic upgrade head`
- **Client checks**: `cd apps/mobile && npm run lint && npm test && npx tsc --noEmit`

## Non-negotiable rules
1. **Pure Domain Layer**: Business rules live in `apps/api/app/domain` as pure functions with zero framework dependencies (no FastAPI, no SQLAlchemy) and thorough unit tests.
2. **Configurable Policies**: Every rule value comes from settings or the database, never a hardcoded magic number in a route or screen.
3. **Financials & Times**: Money is stored in integer cents (EUR/USD). Times are stored in UTC; displayed in the market's timezone (`Europe/Berlin`).
4. **Market Scoping**: Every query must be scoped by `market_id`. Never return another market's data.
5. **Opponent Contact Details Gating**: Contact details (phone/email) are only visible to paid, active enrollees in the same division and program.
6. **Audit Trail**: Every change to results, strikes, division placements, and refunds must write an `AuditLog` row with actor, reason, timestamp, and request ID.
7. **Stripe Idempotency**: Stripe webhooks must be verified with signature checks and processed idempotently via an event tracking table.
8. **Client Type Sync**: Regenerate client types after any API schema change (`npm run api:types`).
9. **Test Discipline**: Add or update tests for every behavior change. Never delete or weaken existing tests to make them pass.
10. **Security & Secrets**: Never read `.env` files containing real secrets, never deploy without approval, and never execute destructive database commands without explicit confirmation.

## Completion report format
At the end of an implementation task, report:
- Changed files
- Commands executed
- Test results
- Assumptions and open risks
