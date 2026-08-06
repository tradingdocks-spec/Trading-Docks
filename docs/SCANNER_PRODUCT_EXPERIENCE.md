# Scanner Product Experience

## Current Status

- Implemented: The active mobile Scan tab now uses a camera-first hierarchy for Card Show Purchase intake.
- Implemented: The primary screen is organized into a compact two-line header, full-screen camera viewport, one concise guide message, three essential controls, compact latest-result overlays, and compact bottom session strip.
- Implemented: Settings, manual search, diagnostics, privacy copy, and calibration controls are secondary panels instead of always-visible stacked cards.
- Implemented: The scanner preserves the existing Apple Vision OCR module, guide-assisted crop mapping, Scryfall lookup, top-three candidates, scanner session persistence, offer calculation, temporary-image cleanup, diagnostics data, and manual search fallback.
- Implemented: Scanner 2.0 remains the reference route for the mobile design OS: compact header, immersive camera work surface, restrained guide motion, status text plus color, compact result overlays, and safe-area session strip.
- Implemented: Scanner-facing primitives are now documented as reusable contracts in `docs/MOBILE_COMPONENT_CONTRACTS.md`; design changes must not imply unbenchmarked recognition certainty.
- Partially Implemented: Auto-capture remains gated by camera readiness and unavailable live visual signals. Native live frame delivery still requires physical-device QA before hands-free capture is production-ready.
- Partially Implemented: High-volume Card Show mode preserves defaults and a compact session workflow, but automatic inventory insertion is not enabled by default.
- Planned: Physical iPhone QA is required for glare, sleeves, old border, showcase, low light, angled cards, rapid replacement, and ten-card high-volume sessions.

## Camera-First Hierarchy

- Implemented: Top header shows scanner mode and card count on the first line, then running market value, running cash offer, and review count only when greater than zero.
- Implemented: The camera area uses most of the first viewport, near-black navy background, four corner brackets, and one prominent instruction.
- Implemented: The primary camera controls are exactly Torch, Capture, and Search. Capture remains the dominant action.
- Implemented: Pause and settings are compact header icon actions. Diagnostics is development-only inside scanner settings.
- Implemented: The bottom session strip stays above the safe area and shows card count, market value, offer total, and Review navigation in one row.
- Implemented: The normal mobile bottom tab bar is hidden only while the Scan route is active and restored when leaving the scanner.
- Implemented: Manual search and settings are explicit panels opened by user action, not inline content that interrupts scanning.

## Scanner State Model

- Implemented: Product-facing pipeline states are `camera_ready`, `aligning`, `capturing`, `reading`, `searching`, `candidate_ready`, `confirmation_required`, `added`, `remove_card`, `ready_for_next`, and `failed`.
- Implemented: Guide states are `idle`, `card_present`, `aligning`, `stabilizing`, `ready`, `capturing`, `processing`, `recognized`, `review_required`, and `failed`.
- Implemented: Every state has visible text in addition to color.
- Implemented: Failed capture or recognition presents Retake and Manual Search recovery instead of silently failing.
- Implemented: Capture, OCR, lookup, saving, secondary sheets, added feedback, and remove-card lockout hide the primary control row to preserve one active scanner surface.

## Result Tray Behavior

- Implemented: Recognized and likely results render as compact trays with thumbnail, card identity, printing, market value, offer value, Add, and Correct without primary confidence percentages.
- Implemented: Ambiguous results expand the tray and show top printing candidates.
- Implemented: Failed OCR produces a compact recovery tray and does not create an automatic "Unrecognized card" session row from the UI path.
- Implemented: Added and remove-card states use brief transient overlays rather than full result cards.
- Implemented: Correction tools allow alternate printing, manual search, condition, finish, language, quantity, market price, storage, Trade Binder, Wishlist, retake, and undo/remove through secondary tray or session tools.
- Partially Implemented: The visual tray uses still-image OCR results and manual pricing; live price ingestion remains outside this sprint.

## High-Volume Workflow

- Implemented: Card Show Purchase is the default scanner mode.
- Implemented: Defaults for condition, finish, language, offer rate, destination, storage, and Trade Binder are preserved through settings and confirmation.
- Implemented: High-confidence results remain suggestion-first unless the user explicitly saves them.
- Implemented: Running totals stay visible while the camera remains available.
- Planned: Haptic and optional sound feedback need device QA and user controls before release.

## Diagnostics Separation

- Implemented: Diagnostics stay behind `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`.
- Implemented: Diagnostics are opened from scanner settings only when development diagnostics are enabled and are not rendered inline in normal scanner mode.
- Implemented: Diagnostics include OCR linked status, scanner lifecycle state, capture ID, crop mapping, crop proof overlays, raw and normalized OCR text, OCR attempt reasons, collector parsing, OCR latency, Scryfall outcome and latency, top-three candidates, cleanup result, guide calibration, and pipeline state where available.

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
## Scanner 2.0 Product Design

Status: Implemented.

Scanner 2.0 changes the mobile scan tab from a stacked engineering tool into a camera-first TCG vision terminal. The camera opens automatically when permission is available, owns the dominant screen region, and uses one prominent instruction at a time.

Implemented hierarchy:

1. Camera viewport
2. Active instruction
3. Compact latest result
4. Pinned session strip
5. Secondary controls and sheets

Result behavior is compact by default. Recognized and likely cards show thumbnail, name, set/collector number, market value, offer value, Add, and Correct without primary confidence percentages. Ambiguous results keep the top-three candidates available without blocking the camera. Failed results show only "Couldn't read the card", Retake, and Search; unidentified cards do not show pricing, quantity, review badges, placeholder thumbnails, session metadata, or technical lookup errors. Added and remove-card states use brief transient overlays instead of full result cards.

High-volume Card Show mode remains explicit. Defaults for condition, finish, language, destination, and cash offer rate remain configurable in scanner settings. Automatic high-confidence acceptance is still disabled until product safety rules allow it.

See also: `docs/SCANNER_2_INTERACTION_SPEC.md` and `docs/SCANNER_2_VISUAL_SPEC.md`.

Mobile design OS references: `docs/TRADING_DOCKS_DESIGN_BIBLE.md`, `docs/MOBILE_ACCESSIBILITY_STANDARD.md`, and `docs/MOBILE_MOTION_STANDARD.md`.
