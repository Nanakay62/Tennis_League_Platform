# ADR 0008: Anonymize Historical Match Results on Account Deletion

## Status
Accepted

## Context
Apple App Store Review Guidelines (Guideline 5.1.1(v)) and GDPR require applications offering account creation to provide an in-app account deletion mechanism.
However, in a sports league platform, outright deleting a player's database rows causes cascading foreign key deletions that would delete historical match records, corrupt opponents' head-to-head records, and invalidate division standings and playoff brackets.

## Decision
When a user initiates account deletion (`DELETE /me`):
1. **PII is scrubbed:** Email is anonymized (`deleted-{id}@anonymized.local`), password hash is overwritten, phone number is deleted, and active tokens are revoked.
2. **Profile Anonymization:** The player's display name is replaced with `"Former Player"` and marked with `is_anonymized = True`.
3. **Standings & Matches Preserved:** Match scores, sets won/lost, and past standings rows are preserved so that the integrity of the league and other active players' standings is unaffected.

## Consequences
- **Positive:** Complies with Apple App Store and GDPR deletion requirements while maintaining 100% mathematical integrity for current and historical season standings.
- **Negative:** Opponents will see "Former Player" instead of the original opponent's name on past match cards.
