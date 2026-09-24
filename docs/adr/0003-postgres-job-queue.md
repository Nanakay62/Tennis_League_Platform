# ADR 0003: PostgreSQL-Backed Job Queue (Procrastinate)

## Status
Accepted

## Context
Background tasks (welcome emails, division kickoff messages, weekly nudges, match auto-confirmation, round deadline enforcement, standings cache refresh, nightly backups) require reliable background processing. Traditional setups introduce Redis and Celery, which increases monthly hosting bills and introduces two-phase commit risks (e.g. email queued for a database transaction that rolls back).

## Decision
We use **Procrastinate**, an asynchronous PostgreSQL-backed job queue for Python:
1. Job tasks are enqueued within the exact same database transaction as business operations.
2. If a database transaction rolls back, the background job is rolled back automatically.
3. No Redis or Celery infrastructure is deployed or paid for.

## Consequences
- **Positive:** Zero extra infrastructure cost; transactional consistency; simple operations using existing PostgreSQL backup and failover routines.
- **Negative:** Very high-throughput messaging (thousands of jobs per second) would place load on PostgreSQL; however, at tennis league scale, this is well within database capacity.
