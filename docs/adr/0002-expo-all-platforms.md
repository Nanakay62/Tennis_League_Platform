# ADR 0002: Expo for Web, iOS, and Android

## Status
Accepted

## Context
The platform must serve players on three distinct platforms:
- Mobile browsers and desktop browsers (for public discovery, SEO, and quick access)
- iPhone native app (via Apple TestFlight and App Store)
- Android native app (via Google Play)

Maintaining three separate codebases (Swift, Kotlin, React) is infeasible for a solo developer or small team and drastically inflates development and maintenance costs.

## Decision
We use a single TypeScript codebase powered by **Expo (React Native + Expo Router)**:
1. `apps/mobile/` delivers universal UI components for web, iOS, and Android.
2. Expo Router provides file-based routing with static HTML generation for public pages (`output: "static"`) and client-side routing for authenticated player portals.
3. Push notifications use the free Expo Push Service.
4. Native builds and App Store submissions are handled through EAS (Expo Application Services).

## Consequences
- **Positive:** Over 90% code reuse across all platforms; single design system; free push notifications; rapid iteration with Expo Go.
- **Negative:** Native device testing must be conducted frequently on real hardware to catch cross-platform styling or keyboard behavior differences early.
