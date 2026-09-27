# App Store & Play Store Compliance Dossier

## 1. Executive Summary
This document provides legal and policy compliance justification for the **Tennis League Platform** on the **Apple App Store** and **Google Play Store**.

---

## 2. Apple App Store Compliance

### 2.1 In-App Purchase Exemption: Guideline 3.1.5(a) Physical Services
Under **Apple App Store Review Guideline 3.1.5(a) (Physical Goods and Services Outside of the App)**:
> *"If your app enables people to purchase physical goods or services that will be consumed outside the app, you must use purchase methods other than in-app purchase, such as Apple Pay or ordinary credit card entry."*

#### League Justification:
- **Service Nature**: The seasonal league entry fee (€34.95 / $34.95) entitles the customer to participate in real-world, in-person tennis matches played on outdoor and indoor courts across the Frankfurt am Main metropolitan region over an 8-week season.
- **Physical Consumption**: The primary economic value delivered to the player is real-world competitive tennis matches, court bookings, physical trophies/awards, and local player coordination.
- **Payment Method**: Registration fees are processed via **Stripe Checkout / Apple Pay via Web/Stripe SDK**, which is strictly required by Guideline 3.1.5(a) instead of Apple Store In-App Purchases (IAP).

---

### 2.2 Account Deletion: Guideline 5.1.1(v)
Under **Apple App Store Review Guideline 5.1.1(v)**:
> *"Apps that support account creation must also allow users to initiate deletion of their account within the app."*

#### League Implementation:
- Located directly in **Profile / Settings** screen (`apps/mobile/src/screens/ProfileScreen.tsx`).
- Executes `POST /account/delete` which performs immediate PII erasure, revokes tokens, clears push tokens, and anonymizes display records in compliance with both Apple Guidelines and GDPR Article 17.

---

### 2.3 User Generated Content & Fair Play: Guideline 1.2
- **Score Discrepancies**: Players can flag disputed scores within a 48-hour cooling-off window (`MatchDispute`).
- **Unsportsmanlike Conduct & No-Shows**: Automated three-strike disciplinary policy (`Strike`) prevents abuse and ensures safe community standards.
- **Opponent Contact Gating**: Phone and email contact details are only revealed to actively enrolled competitors within the same division, preventing harassment or unauthorized scraping.

---

### 2.4 Human Interface Guidelines (HIG) Accessibility
- **Minimum Touch Targets**: All interactive elements (score steppers, buttons, checkboxes, inputs) meet or exceed the mandatory **44×44 pt** touch target threshold (`MIN_TOUCH_TARGET = 44` in `theme/tokens.ts`).
- **Screen Reader Support**: Accessibility labels (`accessibilityLabel`, `accessibilityHint`, `accessibilityRole`) implemented on all scoreboards, standings, and court navigation cards.
- **Auditory Score Formatting**: Scores are formatted phonetically for screen readers (e.g. `"6 to 4, 7 to 5"` instead of `"6-4 7-5"`).

---

## 3. Google Play Store Compliance

### 3.1 Google Play Billing Policy: Physical Recreation Exemption
Under **Google Play's Payments Policy**:
> *"In-app billing is not required for apps that sell physical goods or services that are used outside of the app itself (e.g. purchasing tickets for events, booking athletic facilities or leagues)."*

#### League Implementation:
- Registration fees are processed securely via Stripe without violating Google Play Billing Terms.

### 3.2 Target API Level & Privacy Disclosures
- **Target SDK**: Android 14 (API level 34+).
- **Data Safety Section**: Matches the disclosures in `docs/privacy-data-inventory.md`.
- **Permissions**: Minimal runtime permissions (Network access, optional Push Notifications). No continuous background location or contacts access requested.
