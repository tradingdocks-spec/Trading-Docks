# Scanner 2.0 Visual Specification

Status: Implemented as the visual contract for the mobile Scanner 2.0 route.

Scanner 2.0 uses the existing Trading Docks design tokens and primitives. It does not introduce a second design system.

## Final Hierarchy

1. Camera viewport occupies the dominant region.
2. One active instruction appears over the camera.
3. Latest result is compact and close to the camera.
4. Session strip is pinned above mobile bottom navigation.
5. Settings, diagnostics, correction, and candidate details appear as secondary sheets.

## Visual Direction

- Background: near-black navy.
- Camera overlay: deep translucent navy.
- Active guide: cyan and electric blue.
- Success: emerald.
- Review: amber.
- Trade/cash value accent: restrained purple or emerald depending on context.
- Text: white primary text, muted slate secondary text.

## Scanner Components

- `ScannerHud`: compact top status line with mode, card count, offer total, and review count.
- `ScannerViewport`: bounded camera surface, guide, instruction, and capture controls.
- `ScannerGuide`: four OCR-aligned corner brackets with state tone.
- `ScannerControls`: dominant capture fallback plus secondary torch, pause, manual search, settings, and development-only diagnostics.
- `ScannerStatus`: single active instruction and state label.
- `ScannerResultTray`: compact recognized/likely/ambiguous/failed result.
- `ScannerCandidateSheet`: top-three exact printing selection.
- `ScannerSessionStrip`: pinned session totals and Review Session action.
- `ScannerSettingsSheet`: high-volume defaults and scanner settings.
- `ScannerManualSearchSheet`: manual exact-printing fallback.
- `ScannerDiagnosticsSheet`: development-only lookup and OCR diagnostics.

## Result Behavior

Recognized and likely results show thumbnail, card name, set, collector number, confidence, market value, offer value, and short action controls.

Ambiguous results keep the tray compact and expose top-three candidates in a sheet. The camera remains the primary surface.

Failed results show only a compact recovery banner: "Couldn't read the card", Retake, and Search manually. They never show pricing, quantity, placeholder thumbnails, duplicate notices, or technical exception text.

Resume camera is shown only after the user explicitly pauses. Normal ready, starting, processing, failed, and background recovery states do not show an Open Camera or Resume Camera step.

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
