# ADR 0010: Single-Elimination Playoffs and Tournament Bracket Engine

## Status
Accepted

## Context
At the conclusion of a regular season division (or mid-season tournament), top-performing qualified players advance to single-elimination tournament playoffs:
1. **Bracket Sizing & Byes:** The draw size must be a power of two (4, 8, 16, 32) accommodating uneven numbers of qualified players with automatic byes awarded to top seeds.
2. **Seeding Strategy:** Standard seeding (Seeds 1 & 2 in opposing halves, meeting only in the final; Seeds 3 & 4 meeting only in semifinals) paired with the league's veteran seeding rule (top 75% seeded strictly by standings rank, with the remaining 25% evaluated for veteran status promotion based on career matches played).
3. **Winner Progression & Consolation:** As scores are confirmed, winners advance into subsequent rounds. First-round dropouts can optionally transition into a consolation draw.

## Decision
1. **Pure Domain Bracket Engine (`app/domain/brackets.py`):**
   - Implemented zero-dependency algorithms for power-of-two sizing, seed distribution (`generate_seed_order`), automated bye propagation, winner advancement, and consolation draw initialization.
2. **Playoff Persistence (`app/playoffs/models.py` & `service.py`):**
   - Stored in `playoff_brackets` and `playoff_matches` with foreign key links to `divisions`, `player_profiles`, and recursive `next_match_id` pointers.
   - Match completion triggers automatic participant assignment to the parent match in the next round.
   - Bracket status is set to `completed` upon reporting the final round match.
3. **Client Bracket Tree View:**
   - Single-elimination tournament tree visualizer in `apps/mobile/app/divisions/[divisionId].tsx` with horizontal pan across rounds, seed labels, winner highlight badges, and score reporting dialogs.

## Consequences
- Guarantees deterministic, fair bracket draws matching established tennis tournament standards.
- Fully decoupled pure domain logic allows rapid testing and verification in milliseconds.
