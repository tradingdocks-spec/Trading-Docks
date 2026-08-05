# Scanner Product Experience

## Current Status

- Implemented: The active mobile Scan tab now uses a camera-first hierarchy for Card Show Purchase intake.
- Implemented: The primary screen is organized into a compact top HUD, large camera viewport, concise guide message, latest-result tray, and bottom session bar.
- Implemented: Settings, manual search, diagnostics, privacy copy, and calibration controls are secondary panels instead of always-visible stacked cards.
- Implemented: The scanner preserves the existing Apple Vision OCR module, guide-assisted crop mapping, Scryfall lookup, top-three candidates, scanner session persistence, offer calculation, temporary-image cleanup, diagnostics data, and manual search fallback.
- Partially Implemented: Auto-capture remains gated by camera readiness and unavailable live visual signals. Native live frame delivery still requires physical-device QA before hands-free capture is production-ready.
- Partially Implemented: High-volume Card Show mode preserves defaults and a compact session workflow, but automatic inventory insertion is not enabled by default.
- Planned: Physical iPhone QA is required for glare, sleeves, old border, showcase, low light, angled cards, rapid replacement, and ten-card high-volume sessions.

## Camera-First Hierarchy

- Implemented: Top HUD shows scanner mode, card count, running market value, running cash offer, and review count.
- Implemented: The camera area uses most of the first viewport, near-black navy background, four corner brackets, and one prominent instruction.
- Implemented: Controls are compact icon buttons for torch, pause/resume, capture, manual search, settings, and development diagnostics.
- Implemented: The bottom session bar stays above the safe area and shows card count, market value, offer total, and Session Review navigation.
- Implemented: Manual search and settings are explicit panels opened by user action, not inline content that interrupts scanning.

## Scanner State Model

- Implemented: Product-facing pipeline states are `camera_ready`, `aligning`, `capturing`, `reading`, `searching`, `candidate_ready`, `confirmation_required`, `added`, `remove_card`, `ready_for_next`, and `failed`.
- Implemented: Guide states are `idle`, `card_present`, `aligning`, `stabilizing`, `ready`, `capturing`, `processing`, `recognized`, `review_required`, and `failed`.
- Implemented: Every state has visible text in addition to color.
- Implemented: Failed capture or recognition presents Retake and Manual Search recovery instead of silently failing.

## Result Tray Behavior

- Implemented: Recognized and likely results render as compact trays with card identity, printing, language, finish, condition, quantity, market value, offer, and action buttons.
- Implemented: Ambiguous results expand the tray and show top printing candidates.
- Implemented: Failed OCR produces a recovery tray and does not create an automatic "Unrecognized card" session row from the UI path.
- Implemented: Correction tools allow alternate printing, manual search, condition, finish, language, quantity, market price, storage, Trade Binder, Wishlist, retake, and undo/remove through the existing session tools.
- Partially Implemented: The visual tray uses still-image OCR results and manual pricing; live price ingestion remains outside this sprint.

## High-Volume Workflow

- Implemented: Card Show Purchase is the default scanner mode.
- Implemented: Defaults for condition, finish, language, offer rate, destination, storage, and Trade Binder are preserved through settings and confirmation.
- Implemented: High-confidence results remain suggestion-first unless the user explicitly saves them.
- Implemented: Running totals stay visible while the camera remains available.
- Planned: Haptic and optional sound feedback need device QA and user controls before release.

## Diagnostics Separation

- Implemented: Diagnostics stay behind `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`.
- Implemented: Diagnostics are opened through a development icon and are not rendered inline in normal scanner mode.
- Implemented: Diagnostics include OCR linked status, crop mapping, raw and normalized OCR text, collector parsing, OCR latency, Scryfall latency, top-three candidates, cleanup result, guide calibration, and pipeline state where available.

## Accessibility

- Implemented: Icon-only camera controls have accessibility labels.
- Implemented: Guide and tray states use text labels instead of color-only communication.
- Implemented: Touch targets are at least 48 px for primary camera controls.
- Implemented: Bottom session controls include safe-area padding.
- Requires Production Configuration: VoiceOver, large text, reduced motion, and physical safe-area validation still need device QA.

## Navigation Rules

- Implemented: The Scan tab remains the center primary tab in the five-tab mobile navigation.
- Implemented: Deal Desk is not added as a permanent Collector tab.
- Implemented: Seller and Store Deal Desk access remains available through the existing account-aware navigation and session workflows.

## Remaining Limitations

- Partially Implemented: Apple Vision OCR is iOS development-build behavior; Expo Go is not sufficient for native OCR.
- Partially Implemented: Recognition is OCR plus Scryfall candidate ranking. Artwork recognition, foil recognition, and benchmarked live visual certainty are not claimed.
- Planned: Physical-device QA is required before auto-capture can be enabled by default.
