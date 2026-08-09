# Unified Scanner Product Contract

## Status

- Implemented: The mobile Scan tab opens one Trading Docks Scanner entry plus Review List access.
- Implemented: `/scan/automatic` is the production scanner route.
- Implemented: `/scan/single` is a compatibility alias that renders the same production scanner.
- Implemented: Auto Scan OFF and Auto Scan ON use the same still-capture recognition function.
- Implemented: Auto Scan ON uses an explicit scanner state machine: SEARCHING, FOUND, STABILIZING, READY, CAPTURING, READING, IDENTIFIED, WAITING_FOR_REMOVAL, and REARMED.
- Implemented: Review List remains at `/scanner-session` for post-scan printing review, pricing review, and finalization.
- Planned: Grid Scan remains future work and has no fake production route.
- Planned: pHash, visual descriptors, Apple Vision Feature Print, and fusion remain development-lab evidence only until physical benchmark data proves they improve reliability.

## Navigation

Primary mobile scanner hierarchy:

1. Scan tab
2. Trading Docks Scanner or Review List
3. Auto Scan ON or Auto Scan OFF inside the same scanner

The scanner route is outside the tab group so the camera can be immersive. Back returns to the Scan tab or previous route. Review List can be reached from the Scan tab and the scanner.

## Scanner Surface

Implemented visible surface:

- Back
- Scanner title
- Auto Scan ON/OFF toggle near the header
- Settings
- Full-screen camera
- Detected-card guide using the TCG-ratio framing model plus detected-rectangle outline evidence when available
- One instruction at a time
- Current destination through the session context
- Torch
- Capture when Auto Scan is OFF
- Compact Review List chip with scanned count

Hidden from normal users:

- FPS targets
- OCR terminology
- pHash, Feature Print, visual descriptor, and fusion diagnostics
- Raw camera device labels
- Debug state panels

Diagnostics remain development-only behind `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`.

## Capture Behaviors

- Implemented: Auto Scan OFF is the conservative baseline. The user taps Capture, and the scanner invokes the shared `captureStill` path.
- Implemented: Auto Scan ON evaluates card-present, rectangle confidence, coverage, sharpness, low motion, lighting, glare, brief stability, and duplicate/rearm gates before invoking the same `captureStill` path through `captureStillRef`.
- Implemented: Auto Scan preference is stored in user-scoped local camera preferences.
- Implemented: Auto Scan defaults OFF until physical Golden 50 testing proves reliability.
- Implemented: After a successful capture, auto capture is locked until the card leaves frame or a confident new-card transition is observed.

## Recognition Path

Production golden path:

1. Camera detects enough card evidence to frame the still capture.
2. Scanner captures a sharp still image.
3. Apple Vision rectangle detection runs against the captured still.
4. Still image OCR regions use the detected card rectangle when valid, then fall back to the visible guide crop when rectangle detection is unavailable or weak.
5. Apple Vision Accurate OCR reads multiple title regions.
6. OCR lines are ranked against the local 36k+ Magic-name catalog.
7. Card identity is resolved locally when confidence is sufficient.
8. Scryfall metadata refines exact printing, image, and price when available.
9. Result is added to the user-scoped Review List.

Implemented OCR order:

1. Tight title band.
2. Expanded title band.
3. Lower/alternate title region where configured.
4. Wide title region.
5. Full-card fallback.

The scanner does not assume OCR line 1 is the title. Network data may enrich price, image, and printing metadata, but local catalog matching remains the identity baseline.

## Result And Review

- Implemented: Supported high-confidence results add into the Review List without navigating away from the camera.
- Implemented: Likely or ambiguous results are retained as reviewable candidates instead of being discarded.
- Implemented: Identity failure shows an honest failure state and leaves manual search available.
- Implemented: Exact-printing uncertainty is represented as review work rather than as a total identification failure.
- Implemented: Review List supports Nonfoil, Foil, and Etched controls only when the selected Scryfall printing supports those finishes.
- Partially Implemented: Compact bottom result and last-result tray behavior exists, but physical-device visual QA still needs to verify 320, 375, 390, and 430 px widths, long card names, Dynamic Type, safe areas, and camera visibility.

## Card Outline

- Implemented: The scanner guide reacts to readiness state with cyan, electric blue, emerald, amber, and danger tones.
- Implemented: The camera overlay renders a detected-card outline and corners when live frame geometry is available; the static guide remains as the fallback framing model.
- Planned: The outline should remain calm, avoid constant pulsing, and use red only for true failure states.

## Golden Physical QA

Manual Auto Scan OFF test first:

- 50 labeled physical Magic cards.
- Measure card identity accuracy.
- Measure no-result rate.
- Measure false positive rate.
- Measure exact-printing accuracy.
- Measure median result latency.

Auto Scan ON test only after manual reliability:

- Use the same 50 cards.
- Confirm recognition accuracy matches manual.
- Measure auto trigger success.
- Measure duplicate captures.
- Measure missed cards.
- Measure rearm time.

Success gate:

- Manual: at least 95% correct card identity on the Golden 50.
- Auto: same recognition accuracy as manual, plus reliable trigger and rearm behavior.

Do not optimize cards per minute until these reliability targets are met.

## Validation Checkpoint

Repository validation should include:

- Root TypeScript.
- Mobile TypeScript.
- Focused scanner ESLint.
- Full mobile tests.
- Scanner, OCR, catalog, offline, and camera lifecycle tests.
- Native scanner verification.
- Expo prebuild config inspection.
- Expo install check.
- `git diff --check`.

Remaining manual QA:

- Physical iOS development build camera pass.
- Physical Android development build camera pass.
- Denied camera permission.
- No network.
- Low light.
- Sleeved and foil cards.
- Old border, modern frame, showcase, borderless, token, damaged, and foreign-language cards.
- Repeated remove/rearm cycles.
