# Trading Docks Mobile Foundation 1.1

This build advances Sprint 1 from a set of screens into a reusable mobile foundation.

## Added
- Centralized design tokens for color, typography, spacing, radius, elevation, and motion
- Reusable foundation components for primary actions, surfaces, headers, skeleton states, and loading behavior
- Floating account-aware navigation with a prominent Scan or Deal Desk action
- Haptic feedback for primary navigation and actions
- Apple, Google, email/password, and magic-link authentication entry points
- Password visibility control and stronger authentication trust messaging
- Persistent work-session architecture for buying, trading, scanning, and card-show sessions
- Active session cards on Home, Deal Desk, and Profile
- Pause, resume, and end controls for work sessions
- AsyncStorage-backed offline operation queue foundation
- Settings screen for biometrics, background sync, and haptic preferences
- Account-aware Home labels and actions
- Profile cleanup and a consolidated settings flow

## Production configuration still required
- Apple and Google provider credentials in Supabase
- Native biometric implementation in production builds
- RevenueCat product identifiers and store credentials
- Server-side synchronization worker for queued offline operations
