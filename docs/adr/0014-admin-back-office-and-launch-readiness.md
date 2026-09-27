# ADR 0014: Admin Back Office, Custom Operational Workflows, and Launch Readiness

## Status
Accepted

## Context
Operating the flex tennis league platform in Frankfurt am Main (`Europe/Berlin`) requires robust administrative oversight, rapid dispute mediation, bulk player divisional assignments, discipline enforcement, and strict compliance with EU and app store regulations:
1. **Administrative Back Office**: League commissioners need an authenticated management console for core models (`User`, `PlayerProfile`, `Market`, `Program`, `Division`, `Enrollment`, `Match`, `MatchDispute`, `Strike`, `Court`, `PlayoffBracket`, `UserDevice`, `NotificationLog`).
2. **Immutable Audit Trail (Non-negotiable Rule 6)**: Every administrative mutation (placement, transfer, dispute resolution, strike change, match voiding) must produce a permanent `AuditLog` row with actor ID, entity ID, action, reason, and change JSON.
3. **Custom Operational Workflows**: Automated endpoints are required for bulk player placement, cross-division transfers, dispute resolution (with live standings recalculation), strike management, and match voiding.
4. **App Store Guidelines**: Registration fees must comply with Apple App Store Guideline 3.1.5(a) (physical service exemption allowing direct Stripe payments) and Guideline 5.1.1(v) (in-app account deletion).
5. **GDPR / BDSG Compliance**: Strict privacy inventory, opponent contact details gating (Rule 5), and automated player anonymization (`delete_and_anonymize_user`).
6. **Production Architecture**: Automated TLS via Caddy reverse proxy, containerized FastAPI, PostgreSQL 16, and Procrastinate background queue.

## Decision
1. **SQLAdmin Back Office Mount (`app/admin.py`)**:
   - Integrated SQLAdmin at `/admin` backed by `AdminAuth` session authentication.
   - Enforced role-based access control (`market_admin` and `super_admin` only).
   - Configured custom ModelViews for 14 system entities with search, filters, and read-only protections on sensitive audit trails (`AuditLog`, `NotificationLog`).
2. **Custom Operational Action Endpoints (`app/admin_actions/`)**:
   - Implemented `execute_bulk_placement`, `execute_transfer_player`, `execute_resolve_dispute`, `execute_manage_strike`, and `execute_void_match`.
   - Gated via `get_current_admin_user` FastAPI dependency.
   - Automatically write structured, non-deletable `AuditLog` records and trigger live division standings recalculation on any match or dispute modification.
3. **Regulatory & Store Compliance Dossiers (`docs/`)**:
   - `privacy-data-inventory.md`: Complete GDPR Article 6 & 17 mapping, technical safeguards, and sub-processor documentation.
   - `store-compliance.md`: Formal justification for Apple Guideline 3.1.5(a) physical services exemption, Google Play Billing policies, and HIG accessibility requirements.
4. **Production Deployment Orchestration (`infra/`)**:
   - `docker-compose.prod.yml`: Multi-container production deployment linking PostgreSQL 16, FastAPI backend, Procrastinate worker service, and Caddy 2 reverse proxy.
   - `Caddyfile`: Reverse proxy providing automated Let's Encrypt TLS certificates, security headers (HSTS, CSP, X-Frame-Options), and rate-limited endpoint routing.

## Consequences
- League operators have full operational tooling to govern seasons, resolve score disputes, manage player strikes, and place competitors into balanced divisions.
- Strict compliance with Non-negotiable Rule 6: No operational change can bypass the immutable audit logging pipeline.
- Production-ready containerized deployment and clear documentation ready for App Store and Google Play review submissions.
