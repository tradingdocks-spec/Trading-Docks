# Scanner 2.0 Visual Specification

Status: Implemented as the visual contract for the mobile Scanner 2.0 route.

Scanner 2.0 uses the existing Trading Docks design tokens and primitives. It does not introduce a second design system.

## Final Hierarchy

1. Compact two-line scanner header.
2. Camera viewport occupies the dominant region.
3. One active instruction appears over the camera.
4. Three main controls: Torch, Capture, Search.
5. Compact latest-result tray when needed.
6. Compact session strip pinned above mobile bottom navigation.
7. Settings, diagnostics, correction, and candidate details appear as secondary sheets.

## Visual Direction

- Background: near-black navy.
- Camera overlay: deep translucent navy.
- Active guide: cyan and electric blue.
- Success: emerald.
- Review: amber.
- Trade/cash value accent: restrained purple or emerald depending on context.
- Text: white primary text, muted slate secondary text.

## Scanner Components

- `ScannerHud`: compact two-line header with mode and card count on line 1, then market, offer, and nonzero review count on line 2.
- `ScannerViewport`: bounded camera surface, guide, instruction, and capture controls.
- `ScannerGuide`: four OCR-aligned corner brackets with state tone.
- `ScannerControls`: exactly three primary camera controls: Torch, Capture, Search.
- `ScannerStatus`: single active instruction and state label.
- `ScannerResultTray`: compact recognized/likely/ambiguous/failed result.
- `ScannerCandidateSheet`: top-three exact printing selection.
- `ScannerSessionStrip`: pinned one-row totals and Review action.
- `ScannerSettingsSheet`: high-volume defaults and scanner settings.
- `ScannerManualSearchSheet`: manual exact-printing fallback.
- `ScannerDiagnosticsSheet`: development-only lookup and OCR diagnostics.

## Result Behavior

Recognized and likely results show thumbnail, card name, set, collector number, market value, offer value, Add, and Correct.

Ambiguous results keep the tray compact and expose top-three candidates in a sheet. The camera remains the primary surface.

Failed results show only a compact recovery banner: "Couldn't read the card", Retake, and Search. They never show pricing, quantity, review badges, placeholder thumbnails, duplicate notices, session metadata, or technical exception text.

Resume is available only through the header pause/play control after the user explicitly pauses. Normal ready, starting, processing, failed, and background recovery states do not show an Open Camera or primary Resume Camera step.

## Secondary Surfaces

- Settings sheet: mode, cash percentage, defaults, destination, storage, Trade Binder, and development diagnostics entry.
- Manual search sheet: search field, Scryfall results, and exact-printing selection.
- Candidate sheet area: top-three candidates and printing details.
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
- Session strip stays above bottom navigation.
- Result and sheet content may scroll internally when needed.

## Remaining Limitations

- Foil recognition remains unclaimed until benchmarked.
- OCR accuracy is not claimed; exact-printing confirmation remains required by safety rules.
- Live physical-device QA is still required for camera preview framing, haptics, and reduced-motion behavior.
