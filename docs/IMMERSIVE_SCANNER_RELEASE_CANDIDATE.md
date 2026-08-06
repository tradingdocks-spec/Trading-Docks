# Immersive Scanner Release Candidate

Status: Implemented as the current mobile Scan route presentation contract.

## Scope

Implemented: The active mobile Scan route is now an immersive camera-first surface. The route keeps the existing OCR, Scryfall lookup, confidence model, capture lifecycle, Retake behavior, session persistence, offer math, temporary capture cleanup, diagnostics, and manual-search fallback.

Not Changed: This release candidate does not change the native OCR module, camera lifecycle engine, guide crop mapping, stale result cancellation, scanner session storage, scanner replay, memberships, billing, Supabase schemas, or bottom-navigation account contracts outside the active Scan route.

Requires Production Configuration: Physical iPhone and Android device QA is still required before calling this scanner release-complete.

## Route Presentation

Implemented: While `/(tabs)/scan` is active, the normal bottom tab bar is hidden so there is no empty navigation gap below the camera. Leaving the scanner restores the account-aware five-tab navigation.

Implemented: The primary scanner surface is a full-screen camera with a compact top HUD, one prominent guide instruction, four guide corners, Torch/Capture as primary controls, transient latest-scan feedback, and a compact Review List chip.

Implemented: The primary controls remain Torch and Capture. Manual Search, pause, settings, diagnostics, and review actions are secondary overlays or sheets.

Implemented: The active scanner no longer renders the full result card, Add button, confidence badge, pricing fields, quantity/condition/finish controls, card metadata, or large totals panel.

## State Rules

Implemented: Capture, OCR reading, Scryfall searching, saving, open sheets, added feedback, and remove-card lockout hide the primary control row. This keeps one active visual surface at a time.

Implemented: Added and remove-card states use brief status overlays instead of full result cards. Successful supported matches are added to Scanner Session Review immediately.

Implemented: Failed recognition shows a compact recovery overlay with Retake and Search. It does not show pricing, quantity, review badges, placeholder thumbnails, session metadata, or technical lookup details in the primary UI.

Implemented: High-confidence results enter the Review List as Suggested. Likely and ambiguous results enter as Needs review. Failed reads do not create unknown session rows.

## Secondary Surfaces

Implemented: Scanner settings, manual search, diagnostics, and Review List correction remain available without becoming the primary scanner layout.

Implemented: Development diagnostics remain behind the explicit diagnostics flag and are not shown to production users.

## QA Notes

Requires Production Configuration: Validate safe areas, guide placement, tab restoration, camera fill, text size, VoiceOver, TalkBack, failed OCR, no-match lookup, Retake, manual search, background/foreground, and rapid repeated scans on physical devices.

Planned: Native frame delivery into the Vision Engine, benchmarked recognition confidence, artwork/set-symbol detection, Android OCR, and foil classification remain future scanner work.

## Repository Validation

Implemented: The release-candidate branch passed root TypeScript, mobile TypeScript, focused scanner lint, full mobile tests, Expo web export, Expo prebuild config inspection, Expo dependency check, Apple OCR autolinking search/resolve, and `git diff --check`.

Requires Production Configuration: Physical iOS and Android scanner QA, VoiceOver/TalkBack review, and development-build camera/OCR verification remain manual release gates.
