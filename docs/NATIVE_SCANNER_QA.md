# Native Scanner QA

## Current Status

- Implemented: The mobile Scan screen uses `expo-camera` still capture, back camera selection, autofocus, torch toggle, camera permission states, manual Scryfall search, exact-printing confirmation, Collection write handoff, session lines, and user-scoped scanner replay.
- Implemented: Capture now waits for `onCameraReady` before calling `takePictureAsync`.
- Implemented: A development-only diagnostics overlay is available when `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true` and `NODE_ENV` is not `production`.
- Implemented: The diagnostics overlay reports camera readiness, preview dimensions, guide dimensions, guide ratio, normalized guide crop, capture state, duplicate state, recognition stage, session insertion result, and unavailable visual signals.
- Implemented: Local guide calibration preferences support guide scale and vertical offset for device testing; values are stored only in user-scoped local app storage.
- Partially Implemented: Still captures append an honest "Unrecognized card" session line when visual identification is unavailable, then route the user to manual exact-printing search.
- Partially Implemented: The pure live-frame analyzer can evaluate synthetic luma frames for boundaries, motion, blur, lighting, glare, and crop metadata, but it is not wired to native camera frames in the active UI.
- Planned: Physical-device QA on iOS and Android is required before claiming hands-free auto-capture is operational.
- Planned: Native frame delivery, OCR, artwork matching, set-symbol detection, perspective-corrected image output, and benchmarked finish classification remain future work.

## Critical Workflow

1. Place a card inside the 63 x 88 mm guide.
2. Camera permission is requested if needed.
3. The Capture button remains disabled until `onCameraReady` fires.
4. If native live signals are unavailable, auto-capture remains disabled and manual still capture remains available.
5. A still capture records an explicit visible outcome: captured locally, identification unavailable, manual exact-printing search required.
6. The physical capture is appended to the running scanner session as an unrecognized review line.
7. The user selects the exact printing through manual search and confirms quantity, condition, finish, language, storage, Trade Binder, and Wishlist fields before Collection writes.
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
- Verify manual capture creates a visible session line.
- Verify same stationary card does not repeatedly capture when future auto-capture is connected.
- Verify removing the card rearms the next scan.
- Verify failed capture shows an error and does not discard state.
- Verify manual exact-printing search still saves through the existing Collection mutation path.

## Known Limitations

- Physical-device testing was not performed by Codex.
- Expo Go is not the target for future VisionCamera frame processing; development builds are required.
- No source images are logged, exported, uploaded, or retained by default.
- Foil diagnostics are evidence-only and do not classify finish.
