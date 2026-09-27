# ADR 0009: Score Verification, Discipline, and Contact Gating

## Status
Accepted

## Context
In a flexible, peer-scheduled tennis league, players arrange their own matches and report results. This introduces key challenges:
1. **Reporting Integrity:** Scores must conform strictly to authorized match formats (Best of 3, Match Tiebreak, 10-Game Pro Set, Fast4) and require mutual confirmation or a structured dispute dispute process.
2. **Discipline & Fair Play:** Late cancellations (<4 hours before match, unless weather/overnight exempt), no-shows (minimum 20 minutes wait on court before claiming a walkover), and rematch limits (maximum 2 wins against the same opponent, 3rd match allowed only if split 1-1) must be strictly enforced.
3. **Player Privacy & Safety (GDPR):** Direct contact information (phone numbers and emails) needed for scheduling matches must only be visible to active, paid players within the same division. Unenrolled players or outsiders must be forbidden from accessing phone numbers or emails.

## Decision
1. **Pure Domain Scoring & Discipline Engine:**
   - Implement `scoring.py` and `discipline.py` in `app/domain/` with zero framework or database dependencies.
   - All rules (min 20-min wait, late cancel strikes, rematch thresholds, set formats) are tested with unit tests and property-based tests.
2. **Score Verification Flow:**
   - Winner submits the score (`POST /matches`), creating a match in `submitted` status.
   - Opponent receives notification and confirms (`POST /matches/{id}/confirm`), transitioning status to `confirmed` and triggering atomic division standings recalculation.
   - If contested, opponent files a dispute (`POST /matches/{id}/dispute`), locking the score during a 24-hour cooling-off window for league admin resolution.
3. **Opponent Contact Gating:**
   - Opponent contact details (`GET /divisions/{id}/roster`) require active enrollment in that specific division. Non-enrolled users receive `HTTP 403 Forbidden`.
4. **Audit Trail:**
   - All match result modifications, disputes, walkover claims, and strike issuances are recorded immutably in `audit_logs` with actor ID and rationale.

## Consequences
- Prevents falsified scores and unilateral standings manipulation.
- Complies strictly with privacy regulations by gating phone numbers and emails to division participants.
- Provides a clean audit trail for administrative dispute mediation.
