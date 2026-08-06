# Native Scanner QA

## Current Status

- Implemented: The mobile Scan screen uses `expo-camera` still capture, back camera selection, autofocus, torch toggle, camera permission states, manual Scryfall search, exact-printing confirmation, Collection write handoff, session lines, and user-scoped scanner replay.
- Implemented: Capture now waits for `onCameraReady` before calling `takePictureAsync`.
- Implemented: A development-only diagnostics overlay is available when `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true` and `NODE_ENV` is not `production`.
- Implemented: The diagnostics overlay reports camera readiness, scanner lifecycle state, capture ID, preview dimensions, captured image dimensions, source and normalized orientation, guide dimensions, guide ratio, normalized guide crop, title crop variants, collector crop, crop pixel sizes, OCR attempts, duplicate state, recognition stage, Scryfall outcome, session insertion result, and unavailable visual signals.
- Implemented: Local guide calibration preferences support guide scale and vertical offset for device testing; values are stored only in user-scoped local app storage.
- Implemented: Still captures on the new iOS development build run local Apple Vision OCR, query Scryfall, show top-three Magic candidates, require exact-printing confirmation, and preserve manual search fallback.
- Implemented: The primary Scan tab now uses a camera-first layout with compact controls, one guide instruction, latest-result tray, secondary settings/manual/diagnostics panels, and a safe-area-aware bottom session bar.
- Partially Implemented: The pure live-frame analyzer can evaluate synthetic luma frames for boundaries, motion, blur, lighting, glare, and crop metadata, but it is not wired to native camera frames in the active UI.
- Planned: Physical-device QA on iOS and Android is required before claiming hands-free auto-capture is operational.
- Planned: Native frame delivery, artwork matching, set-symbol detection, perspective-corrected image output, Android OCR, and benchmarked finish classification remain future work.

## Critical Workflow

1. Place a card inside the 63 x 88 mm guide.
2. Camera permission is requested if needed.
3. The Capture button remains disabled until `onCameraReady` fires.
4. If native live signals are unavailable, auto-capture remains disabled and manual still capture remains available.
5. A still capture records an explicit visible OCR flow: `Reading title`, then `Finding card`.
6. Apple Vision reads local guide-assisted OCR regions; Scryfall receives text metadata only.
7. The user reviews the top Magic candidate, alternatives, raw OCR title, normalized title, collector observations, confidence, and "Why this match?"
8. The user accepts a candidate or chooses an alternative, then confirms quantity, condition, finish, language, storage, Trade Binder, and Wishlist fields before Collection writes or session insertion.
8. Duplicate and removal behavior remains enforced by the continuous scanner contracts; physical card-removal timing still needs device QA.

## Diagnostics Overlay

- Requires Production Configuration: The overlay is disabled in production and appears only when the public development flag is explicitly set.
- Implemented diagnostics fields:
  - camera ready
  - preview width and height
  - guide width, height, and aspect ratio
  - normalized guide crop
  - detected bounds and visible corners when a native provider supplies them
  - fill, perspective, blur, motion, lighting, glare, and stability when a native provider supplies them
  - capture state
  - duplicate/rearm status
  - recognition stage and latency
  - session insertion result
- Implemented calibration controls:
  - guide scale
  - vertical offset
  - reset to defaults
- Planned diagnostics fields:
  - real card bounds and corners from native frame delivery
  - real blur, motion, lighting, glare, and stability samples from device frames
  - recognition latency after OCR/artwork providers are connected

## Device QA Matrix

| Platform | Device | Build Type | Safe Area | Lighting | Sleeve | Angle | Result | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| iOS | iPhone small width | Development build | Not tested | Normal | Unsleeved | Flat | Pending | Requires physical device |
| iOS | iPhone large width | Development build | Not tested | Glare | Sleeved | Tilted | Pending | Requires physical device |
| Android | Phone | Development build | Not tested | Low light | Sleeved | Flat | Pending | Requires physical device |
| Web | Narrow viewport | Expo web fallback | N/A | N/A | N/A | N/A | Manual fallback | Camera recognition unavailable |

## Manual QA Checklist

- Verify back camera opens on iOS and Android.
- Verify camera does not capture before ready.
- Verify torch toggles without restarting the scanner.
- Verify guide matches a sleeved Magic card without stretching.
- Verify safe-area top inset does not push the guide off-screen.
- Verify leaving and re-entering the Scan tab resets camera readiness cleanly.
- Verify app background and foreground do not trigger capture.
- Verify manual capture creates OCR results and does not add a session line until the user confirms a candidate.
- Verify failed OCR shows Retake and Manual Search and does not create an automatic unknown-card session row.
- Verify the latest-result tray fits small iPhone widths and large text.
- Verify scanner settings, manual search, and diagnostics panels open and close without blocking the camera state.
- Verify bottom session bar remains above the iOS safe area and mobile tab bar.
- Verify temporary capture cleanup status reports deleted in diagnostics.
- Verify same stationary card does not repeatedly capture when future auto-capture is connected.
- Verify removing the card rearms the next scan.
- Verify failed capture shows an error and does not discard state.
- Verify manual exact-printing search still saves through the existing Collection mutation path.
- Verify primary, expanded, lower, wide, and full-card crop proof overlays align with the captured card.
- Verify failed OCR Retake resumes camera without a manual Resume camera tap.
- Verify explicit Pause remains paused until Resume camera is tapped.
- Verify airplane mode produces network-safe recovery and does not add a session row.
- Verify repeated retake does not show stale OCR text or stale candidates.
- Verify one accepted capture adds one session row and does not duplicate.
- Verify five-card and ten-card sessions preserve running totals.

## Known Limitations

- Physical-device testing was not performed by Codex.
- Expo Go is not the target for future VisionCamera frame processing; development builds are required.
- No source images are logged, exported, uploaded, or retained by default; iOS still captures are deleted after OCR processing.
- Foil diagnostics are evidence-only and do not classify finish.
## Scanner 2.0 Physical-Device QA

Status: Requires Production Configuration.

Run these checks on an iOS development build after this branch:

- Scan tab opens with camera active when permission is granted.
- No normal state shows an "Open camera" step.
- Camera is dominant on 320, 375, 390, and 430 px widths.
- Dynamic Island and safe areas do not clip the HUD.
- Result trays do not overlap camera controls.
- Session strip clears the bottom tab bar.
- Failed result shows only compact recovery copy and Retake/Search manually.
- Long card names and long set names do not collapse into narrow columns.
- Reduced Motion suppresses decorative pulse/flash.
- Apple Vision OCR still returns title and collector observations.
- TradingDocksVisionOcr remains autolinked in a clean EAS development build.
- Crop proof aligns on a readable Magic card such as Sporecrown Thallid.
- Long title, old border, borderless, sleeved, glare, low light, angled, partially obscured title, same-name reprint, repeated retake, app background/foreground, airplane mode, five-card session, and ten-card session cases are recorded.
