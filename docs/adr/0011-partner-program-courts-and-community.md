# ADR 0011: Partner Program, Courts Directory, and Community Features

## Status
Accepted

## Context
Beyond scheduled division flex matches, tennis league participants seek practice partners, court booking information, and incentives to engage with the league community:
1. **Practice Partner Matching:** Players need to find compatible practice partners within a ±0.5 NTRP rating band, matching preferred play schedules (daytime vs. evening) and geographic proximity within Frankfurt am Main.
2. **Monthly Partner Reward Program:** To encourage friendly hitting sessions and community engagement, players who hit with 3 distinct verified partners in a calendar month earn a €5 credit toward their next season enrollment.
3. **Frankfurt Courts Directory:** Players need a curated directory of local tennis venues with key attributes: surface type (clay, hard, carpet), indoor/outdoor, floodlights, practice backboards/walls, reservation links, and community ratings/reviews.
4. **Player of the Year (POTY) & Referrals:** Recognition for active participants based on regular season matches, playoff victories, verified partner hits, and community referrals with unique referral codes.

## Decision
1. **Pure Domain Matching & Incentives (`app/domain/partners.py`):**
   - Zero-dependency algorithms:
     - `filter_compatible_partners()`: Filters by ±0.5 NTRP band, overlapping schedule availability, and area proximity.
     - `evaluate_monthly_partner_reward()`: Checks for 3+ distinct partner sessions within a calendar month to award 500 cents (€5) credit.
     - `calculate_poty_points()`: Transparent scoring formula: 10 pts per match played, 5 pts per win, 15 pts per playoff win, 3 pts per partner hit, and 20 pts per completed referral.
2. **Community & Directory Persistence (`app/community/`):**
   - Entities: `Court`, `CourtReview`, `Referral`.
   - Gated contact visibility: Partner contact details are only accessible to verified, paid league members.
   - Comprehensive REST APIs for court listings/filters, reviews, compatible partner search, POTY standings leaderboard, and referral code sharing.
3. **Mobile Client Interface (`apps/mobile/`):**
   - `courts/index.tsx`: Interactive court directory with amenity filter chips (Clay, Hard, Carpet, Indoor, Floodlights, Wall), Google Maps links, and rating stars.
   - `partners/index.tsx`: Practice partner matching interface with skill band filters, monthly reward tracker banner, and one-tap WhatsApp/email contact.
   - `community/poty.tsx`: Player of the Year leaderboard with top-3 podium display, point breakdown, and personal referral link generator with native share modal.

## Consequences
- High-retention community flywheel: Practice partner program and referral incentives drive off-season and mid-season engagement.
- Frankfurt players easily locate courts matching weather and surface preferences (e.g. indoor carpet in winter, outdoor red clay in summer).
- All financial rewards are strictly handled in integer cents (e.g., 500 cents for €5 credit).
