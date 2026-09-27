# Privacy & Data Protection Inventory (GDPR / DSGVO)

## 1. Overview & Applicability
This data inventory documents all Personal Identifiable Information (PII) processed by the Tennis League Platform operating primarily in the **Frankfurt am Main** market (`Europe/Berlin`, EUR). The platform complies strictly with the European General Data Protection Regulation (**GDPR** / DSGVO) and the German Federal Data Protection Act (**BDSG**).

---

## 2. Personal Data Categories & Retention Schedule

| Data Category | Specific Data Elements | Purpose & Processing Activity | Legal Basis (GDPR) | Retention Period |
| :--- | :--- | :--- | :--- | :--- |
| **Identity & Authentication** | Email address, Bcrypt-hashed password | User account creation, authentication, password resets, session management | Art. 6(1)(b) Contract Performance | Account lifetime + 30 days after deletion request |
| **Player Profile** | Display name, Self-rating (NTRP 2.5–5.0), Home area (e.g., Sachsenhausen, Westend), Daytime preference | League division placement, leaderboard presentation, scheduling | Art. 6(1)(b) Contract Performance | Account lifetime; anonymized upon deletion |
| **Contact Information** | Phone number (mobile) | Direct opponent contact for match scheduling | Art. 6(1)(b) Contract Performance | Account lifetime; cleared immediately upon deletion |
| **League & Playoff Records** | Match scores, dates, dispute logs, playoff brackets, strikes | League standings computation, fair play enforcement, historical records | Art. 6(1)(f) Legitimate Interest (Sporting Integrity) | Retained indefinitely with player name anonymized |
| **Device & Push Notification Data** | Expo Push Token, Device platform (iOS/Android) | Match confirmations, dispute notifications, season kickoff broadcasts | Art. 6(1)(a) Consent | Until token invalidation or user logout |
| **Payment Metadata** | Stripe Customer ID, Checkout Session ID, Invoice payment status | Season registration verification, dispute refunds | Art. 6(1)(b) & Art. 6(1)(c) Legal Tax Obligation | 10 years (German Commercial Code § 257 HGB / § 147 AO) |

> [!IMPORTANT]
> **Zero In-House Cardholder Data Storage**: No credit card numbers, CVVs, or expiration dates ever touch platform servers or databases. All payment transactions are handled exclusively by **Stripe Inc.** (PCI-DSS Level 1 Service Provider).

---

## 3. Privacy-by-Design Technical Safeguards

### 3.1 Opponent Contact Details Gating (Non-negotiable Rule 5)
- Opponent phone numbers and email addresses are **never public**.
- Access is strictly restricted to paid, actively placed players within the exact same division and season.
- Outsiders, players from other divisions or markets, and unregistered visitors receive `403 Forbidden` when querying division rosters with contact details.

### 3.2 Right to Erasure / Account Deletion (GDPR Art. 17 & Apple Guideline 5.1.1(v))
- Users can delete their account directly within mobile settings via `POST /account/delete`.
- Execution calls `delete_and_anonymize_user`:
  1. Revokes and purges all refresh tokens and active sessions.
  2. Unregisters all push notification device tokens (`UserDevice`).
  3. Replaces display name with `"Anonymized Player"`.
  4. Nullifies and overwrites phone numbers, addresses, and private notes.
  5. Marks `is_anonymized = True` and `is_active = False`.
  6. Preserves historical match set scores to maintain integrity of opponent win/loss records and division standings without referencing personal identity.

### 3.3 Strict Administrative Audit Trail (Non-negotiable Rule 6)
- Any modification made by platform administrators (dispute resolutions, strike adjustments, manual score corrections, divisional transfers) creates an immutable `AuditLog` row containing actor ID, entity ID, action, timestamp, and full JSON payload change.
- Audit logs are read-only and cannot be altered or deleted.

---

## 4. Third-Party Sub-Processors

| Sub-Processor | Location | Purpose | Safeguard / Data Transfer Mechanism |
| :--- | :--- | :--- | :--- |
| **Stripe Payments Europe, Ltd.** | Dublin, Ireland | Payment processing, checkout, refund handling | EU entity / Standard Contractual Clauses (SCC) |
| **Expo (650 Industries, Inc.)** | USA | Push notification relay to Apple APNs and Google FCM | Encrypted ephemeral push tokens, Data Processing Addendum (DPA) |
| **Resend / SMTP Gateway** | EU / Frankfurt | Transactional email delivery (kickoffs, password reset) | GDPR DPA with EU hosting option |
| **Hetzner Online GmbH** | Falkenstein / Frankfurt, Germany | Dedicated server hosting, PostgreSQL database, Procrastinate job queue | Fully hosted within the EU (Germany) under strict BDSG/GDPR DPA |

---

## 5. Contact & Data Protection Officer (DPO)
For privacy inquiries, data subject access requests (Art. 15 GDPR), or rectification requests:
- **Controller**: Tennis League Platform Frankfurt
- **Email**: `privacy@tennis-league.de`
- **Location**: Frankfurt am Main, Germany
