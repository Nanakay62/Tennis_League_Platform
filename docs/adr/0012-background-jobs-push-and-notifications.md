# ADR 0012: Background Jobs, Push Notifications, and Transactional Dispatch

## Status
Accepted

## Context
A competitive flex tennis league depends on timely operational communications and asynchronous automation to run smoothly:
1. **Division Kickoff Broadcast:** When a season begins, players require their division schedule and opponent contact details (strictly gated by division to maintain GDPR privacy compliance).
2. **Weekly Inactivity Nudges:** Players who have not reported a match within a configured window (default 7 days) receive automated, encouraging reminders to book Frankfurt courts before the playoff deadline.
3. **Score Auto-Confirmation:** Opponents have a 48-hour dispute window following match reporting. If no dispute is filed within 48 hours, the match must automatically confirm, update live division standings, and notify participants.
4. **Nightly Encrypted Database Backups:** Automated creation of timestamped, encrypted database snapshots designated for Cloudflare R2 bucket replication with mandatory audit logging.
5. **Cross-Platform Push & Transactional Email:** Delivery via Expo Push Notification service and transactional email (Resend / AWS SES / Console logger) with strict adherence to user communication preference toggles.

## Decision
1. **Pure Domain Logic (`app/domain/jobs.py`):**
   - Zero framework dependencies:
     - `is_match_auto_confirmable()`: Validates whether 48-hour dispute window has lapsed.
     - `is_player_inactive()`: Checks inactivity based on last match date or season start date.
     - `validate_expo_push_token()`: Regex format validation for `ExponentPushToken[...]`.
     - `format_kickoff_notification()`: Generates division schedule and roster payload with opponent phone/email strictly scoped to active division co-participants.
     - `format_inactive_nudge()`, `format_auto_confirm_notification()`, `format_backup_filename()`.
2. **Persistence & Device Tracking (`app/notify/`):**
   - `UserDevice`: Tracks active push notification tokens and device platforms (iOS, Android, Web).
   - `NotificationLog`: Records sent, skipped, or failed notifications per user with channel and event type.
   - Respects `CommunicationPreference` toggles (`email_kickoff`, `email_reminders`, `email_results`, `push_kickoff`, `push_reminders`, `push_results`).
3. **Procrastinate Worker Engine (`app/jobs.py`):**
   - Initialized with `PsycopgConnector` for production/PostgreSQL and `InMemoryConnector` for isolated unit/integration test suites.
   - Tasks:
     - `kickoff_broadcast`: Division schedule and roster broadcast with `AuditLog` entry.
     - `inactive_player_nudges`: Market-wide activity scan and reminder notifications.
     - `auto_confirm_matches`: Automatic transition of submitted matches older than 48 hours, live standings recalculation, and `AuditLog` entry.
     - `nightly_database_backup`: Encrypted backup filename generation, R2 cloud storage archive metadata, and `AuditLog` entry.
4. **Client Interface (`apps/mobile/`):**
   - Added push device registration and history retrieval methods in `apps/mobile/src/api/client.ts`.
   - Updated `settings/notifications.tsx` with a live feed of recent notifications, event-type icons, badges, and localized timestamps.

## Consequences
- Automated lifecycle: Flex leagues operate autonomously without requiring manual staff intervention for match confirmations, nudges, or roster emails.
- Non-negotiable rules preserved: Contact details remain gated strictly within divisions; all financial amounts use integer cents; all automated changes write `AuditLog` records.
- Cross-platform reliability: Graceful offline and mock fallback allows complete local development without third-party service dependencies.
