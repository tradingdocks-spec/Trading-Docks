# Branded Sign-In Entrance — v143

## What changed

- Added a restrained Trading Docks “Docking Sequence” after successful sign-in.
- Three collectible-card silhouettes align around the Trading Docks mark.
- A subtle cyan synchronization signal confirms the workspace is ready.
- The destination renders behind the overlay so the motion masks loading rather
  than delaying it.
- Email/password and Google authentication use the same entrance.
- Deep links and onboarding destinations are preserved.
- Failed sign-in attempts do not trigger the entrance.
- The URL trigger is removed immediately so refreshing does not replay it.
- Reduced-motion preferences receive an abbreviated static transition.

## Database changes

None.
