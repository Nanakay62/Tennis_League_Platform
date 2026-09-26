# ADR 0006: Dual-Token Strategy for Web and Native Clients

## Status
Accepted

## Context
The platform supports Web, iOS, and Android clients from a shared API. Authentication must protect against XSS and CSRF on web, while persisting sessions securely on mobile devices without relying on third-party auth vendors.

## Decision
We implement a dual-token strategy:
1. **Access Token:** Short-lived signed JWT (15 minutes), containing `sub` (user_id), `market_id`, and `role`. Kept in memory on web and in `expo-secure-store` on native.
2. **Refresh Token:** Cryptographically secure random 64-byte string, stored hashed (SHA-256) server-side, with a 30-day lifetime.
3. **Token Rotation & Family Revocation:** Every refresh call issues a new token pair and revokes the old refresh token. If an already-revoked refresh token is presented, the system detects a token reuse attack and immediately invalidates all active sessions in that family.
4. **Storage:**
   - Native: `expo-secure-store` (iOS Keychain / Android Keystore).
   - Web: Secure storage (`localStorage` for prototype / HttpOnly cookie for production).

## Consequences
- **Positive:** Zero per-user vendor auth fees; immediate detection and mitigation of compromised tokens; seamless session continuity on mobile.
- **Negative:** Client must handle refresh rotation logic when access tokens expire.
