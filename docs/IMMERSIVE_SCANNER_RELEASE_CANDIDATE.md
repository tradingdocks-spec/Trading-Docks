# Immersive Scanner Release Candidate

Status: Implemented as the current mobile Scan route presentation contract.

## Scope

Implemented: The active mobile Scan route is now an immersive camera-first surface. The route keeps the existing OCR, Scryfall lookup, confidence model, capture lifecycle, Retake behavior, session persistence, offer math, temporary capture cleanup, diagnostics, and manual-search fallback.

Not Changed: This release candidate does not change the native OCR module, camera lifecycle engine, guide crop mapping, stale result cancellation, scanner session storage, scanner replay, memberships, billing, Supabase schemas, or bottom-navigation account contracts outside the active Scan route.

Requires Production Configuration: Physical iPhone and Android device QA is still required before calling this scanner release-complete.

## Route Presentation

Implemented: While `/(tabs)/scan` is active, the normal bottom tab bar is hidden so there is no empty navigation gap below the camera. Leaving the scanner restores the account-aware five-tab navigation.

Implemented: The primary scanner surface is a full-screen camera with a compact top HUD, one prominent guide instruction, four guide corners, exactly three primary controls, transient result/status overlays, and a pinned session summary.

Implemented: The three primary controls remain Torch, Capture, and Search. Pause, settings, correction, manual search, diagnostics, and review actions are secondary overlays or sheets.

## State Rules

Implemented: Capture, OCR reading, Scryfall searching, saving, open sheets, added feedback, and remove-card lockout hide the primary control row. This keeps one active visual surface at a time.

Implemented: Added and remove-card states use brief status overlays instead of full result cards.

Implemented: Failed recognition shows a compact recovery overlay with Retake and Search. It does not show pricing, quantity, review badges, placeholder thumbnails, session metadata, or technical lookup details in the primary UI.

Implemented: Recognized and likely results keep confidence wording but do not show confidence percentages in the primary result.

## Secondary Surfaces

Implemented: Scanner settings, manual search, diagnostics, correction controls, and top-three alternatives remain available without becoming the primary scanner layout.

Implemented: Development diagnostics remain behind the explicit diagnostics flag and are not shown to production users.

## QA Notes

Requires Production Configuration: Validate safe areas, guide placement, tab restoration, camera fill, text size, VoiceOver, TalkBack, failed OCR, no-match lookup, Retake, manual search, background/foreground, and rapid repeated scans on physical devices.

Planned: Native frame delivery into the Vision Engine, benchmarked recognition confidence, artwork/set-symbol detection, Android OCR, and foil classification remain future scanner work.
