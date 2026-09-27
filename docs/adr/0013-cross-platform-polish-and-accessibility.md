# ADR 0013: Cross-Platform Polish, Design Tokens, and WCAG Accessibility

## Status
Accepted

## Context
A cross-platform flex tennis league application deployed on Web, iOS, and Android must ensure an inclusive, high-contrast, and responsive user experience:
1. **Viewport & Responsive Scaling:** Players access the platform across compact 375px mobile screens (iPhone SE/mini), tablets, and >=1024px desktop monitors.
2. **WCAG 2.1 AA & Touch Targets:** Touch targets must measure at least 44×44pt to avoid mis-taps during on-court usage and comply with Apple Human Interface Guidelines and WCAG 2.1 Success Criterion 2.5.5.
3. **Screen Reader Score Interpretation:** Standard tennis score strings (e.g. "6-4; 7-6; TB 10-8") must be translated into natural, audible phrasing ("6 games to 4; 7 games to 6 with tiebreak; Match tiebreak 10 points to 8") for VoiceOver and TalkBack screen readers.
4. **Theme Tokens & Dark Mode:** Semantic design tokens (spacing, typography, radius, breakpoints) and a dark mode color palette with accessible contrast ratios.
5. **Offline Fault Tolerance:** Resilient cache policy preserving league tables and court directories for offline viewing with prominent cached status indicators.

## Decision
1. **Design Tokens & Responsive Breakpoints (`src/theme/`):**
   - `tokens.ts`: Standardized spacing scale (`xs: 4` to `xxl: 48`), typography scale, and responsive breakpoints (`mobileMax: 767`, `tabletMin: 768`, `desktopMin: 1024`).
   - `colors.ts`: Added `darkColors` palette and `useThemeColors()` hook supporting automatic theme switching based on device appearance.
2. **Accessibility Utilities & Components (`src/lib/` & `src/components/`):**
   - `formatScoreForScreenReader()`: Pure function translating tennis scores and tiebreaks into natural spoken phrasing.
   - `AccessibleButton`: Standard button enforcing minimum 44×44pt touch dimensions, accessibility roles, labels, and hints.
   - Audited and upgraded interactive elements across score submission steppers, court booking/map buttons, practice partner contacts, and leaderboard cards to adhere to `MIN_TOUCH_TARGET = 44`.
3. **Offline Tolerance & Indicators (`_layout.tsx` & `OfflineBanner.tsx`):**
   - Configured TanStack Query with `gcTime: 24h` and `networkMode: "offlineFirst"`.
   - Added `OfflineBanner` displaying a non-intrusive status banner when viewing cached league data.

## Consequences
- Inclusive on-court user experience: Players can quickly tap score steppers and directions without precision fatigue.
- Full screen reader compliance: Visually impaired players receive rich, natural audio feedback for matches, standings, and tournament brackets.
- Zero-cost offline resiliency: Players without mobile data at remote tennis facilities can still view their match schedules and court directions from cache.
