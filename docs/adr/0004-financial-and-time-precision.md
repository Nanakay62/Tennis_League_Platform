# ADR 0004: Financial Precision and UTC Timestamps

## Status
Accepted

## Context
Financial calculations (discounts, tiered prices, credits, Stripe payments, refunds) are susceptible to floating-point rounding errors. Scheduling across different regional markets with daylight-saving changes can cause deadline inaccuracies and pricing tier disputes.

## Decision
1. **Money**: All monetary values are strictly represented and stored as **integer cents** (e.g. €32.95 is represented as `3295`).
2. **Timestamps**: All database datetimes are stored in **UTC**.
3. **Market Local Time**: Every market record stores its IANA timezone (e.g., `Europe/Berlin` for Frankfurt). Price cutoffs and match deadline calculations are computed against the market's specific local time before converting to UTC.

## Consequences
- **Positive:** Zero floating-point rounding errors; Stripe integration maps directly 1:1 with integer amounts; reliable scheduling across seasonal daylight-saving transitions.
- **Negative:** Display layers must always format cents to currency strings with appropriate locale formatting.
