# Scanner 2.0 Visual Specification

Status: Implemented as the visual contract for the mobile Scanner 2.0 route.

Scanner 2.0 uses the existing Trading Docks design tokens and primitives. It does not introduce a second design system. It is the reference implementation for the mobile design OS documented in `docs/TRADING_DOCKS_DESIGN_BIBLE.md`, `docs/MOBILE_COMPONENT_CONTRACTS.md`, `docs/MOBILE_ACCESSIBILITY_STANDARD.md`, and `docs/MOBILE_MOTION_STANDARD.md`.

## Final Hierarchy

1. Compact two-line scanner header.
2. Camera viewport fills the active route while scanning.
3. One active instruction appears over the camera.
4. Three main controls: Torch, Capture, Search.
5. Tiny transient latest-scan confirmation when a row is added.
6. Compact Review List chip pinned above the safe area while the Scan route hides the normal tab bar.
7. Settings, diagnostics, and manual search appear as secondary sheets.

## Visual Direction

- Background: near-black navy.
- Camera overlay: deep translucent navy.
- Active guide: cyan and electric blue.
- Success: emerald.
- Review: amber.
- Trade/cash value accent: restrained purple or emerald depending on context.
- Text: white primary text, muted slate secondary text.

## Scanner Components

- `ScannerHud`: compact two-line header with mode and scanned count on line 1, then offer and nonzero review count on line 2.
- `ScannerViewport`: full-screen camera surface, guide, instruction, and capture controls.
- `ScannerGuide`: four OCR-aligned corner brackets with state tone.
- `ScannerControls`: exactly three primary camera controls: Torch, Capture, Search.
- `ScannerStatus`: single active instruction and state label.
- `ScannerFailureOverlay`: compact failed-read Retake/Search recovery only.
- `ScannerToast`: tiny Added or Added for review confirmation with Undo and Correct.
- `ScannerSessionStrip`: pinned one-row scanned/review count and Review List action.
- `ScannerSettingsSheet`: high-volume defaults and scanner settings.
- `ScannerManualSearchSheet`: manual exact-printing fallback.
- `ScannerDiagnosticsSheet`: development-only lookup and OCR diagnostics.

Shared primitive mapping:

- `ScannerGuide` aligns with `TDScannerGuide`.
- `ScannerSessionStrip` aligns with `TDSessionStrip`.
- Icon actions align with `TDIconButton`.
- Settings and candidate surfaces align with `TDSheet`.

## Result Behavior

Recognized, likely, and ambiguous supported matches do not render an active result card. They add to the Review List immediately and show only a tiny transient confirmation.

High-confidence matches enter as Suggested. Likely and ambiguous matches enter as Needs review. The camera remains the primary surface.

Failed results show only a compact recovery banner: "Couldn't read the card", Retake, and Search. They never show pricing, quantity, review badges, placeholder thumbnails, duplicate notices, session metadata, or technical exception text.

Added and remove-card states use a brief status overlay. They do not replace the camera with a full success card.

Resume is available only through the header pause/play control after the user explicitly pauses. Normal ready, starting, processing, failed, and background recovery states do not show an Open Camera or primary Resume Camera step.

## Secondary Surfaces

- Settings sheet: mode, cash percentage, defaults, destination, storage, Trade Binder, and development diagnostics entry.
- Manual search sheet: search field, Scryfall results, and exact-printing selection that adds directly to Review List.
- Diagnostics sheet: development-only native module, OCR, Scryfall, cleanup, lifecycle, and crop proof details.
- Session Review route: scanned cards, edits, missing prices, export, and finalize workflow.

## Motion Rules

- No constant pulsing.
- Ready/success may pulse once.
- Capturing may flash once.
- Processing uses restrained progress.
- Reduced-motion mode disables decorative pulse/flash behavior.

## Safe-Area Rules

- Top HUD respects Dynamic Island and status areas.
- Camera does not scroll behind result surfaces.
- Scan route hides the normal bottom navigation and restores it after leaving the route.
- Result and sheet content may scroll internally when needed.

## Remaining Limitations

- Foil recognition remains unclaimed until benchmarked.
- OCR accuracy is not claimed; exact-printing confirmation remains required by safety rules.
- Live physical-device QA is still required for camera preview framing, haptics, and reduced-motion behavior.
