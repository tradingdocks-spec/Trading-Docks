# Native Magic OCR V1

## Current Status

- Implemented: `mobile/modules/trading-docks-vision-ocr` is a local Expo module that uses Apple Vision `VNRecognizeTextRequest` for iOS still-image OCR.
- Implemented: The TypeScript adapter returns structured success and failure results, including full text, per-region observations, confidence, normalized bounding boxes, latency, orientation, warnings, and native error codes.
- Implemented: Android and web return explicit unsupported states; they do not pretend OCR works.
- Implemented: `mobile/services/magic-ocr-pipeline.ts` maps the visible 63:88 guide to captured-image coordinates, normalizes rotated iPhone still dimensions to the live preview orientation, requests targeted OCR regions, normalizes Magic title and collector text, queries Scryfall, returns top-three candidates, and deletes temporary captures.
- Partially Implemented: The mapping is guide-assisted crop mapping. It accounts for preview/image aspect ratio, cover-style preview cropping, and captured-still orientation mismatch, but it is not four-corner perspective correction.
- Partially Implemented: Confidence uses real title, set-code, collector-number, and language observations. Artwork, set-symbol, and finish recognition remain unavailable and contribute no positive evidence.
- Requires Production Configuration: A new EAS development build is mandatory before physical iPhone QA because native Swift code and direct `expo-file-system` dependency resolution changed.

## Native Module

- Module name: `TradingDocksVisionOcr`
- iOS implementation: `mobile/modules/trading-docks-vision-ocr/ios/TradingDocksVisionOcrModule.swift`
- JS API: `recognizeText({ imageUri, regions, languages, recognitionLevel })`
- Apple API: `VNRecognizeTextRequest` with `.accurate` or `.fast` recognition, `recognitionLanguages`, `usesLanguageCorrection`, and `regionOfInterest`.
- Supported iOS: Apple Vision text recognition requires iOS 13 or newer; Expo SDK 54 development builds target newer iOS baselines.
- Android: unsupported safe stub in this branch.

## OCR Regions

- title primary
- title expanded
- title lower
- title wide
- full-card title fallback
- collector information
- bottom left
- bottom right
- optional type line

The active scanner sends normalized image-space rectangles. Source image paths, image bytes, and recognized text are not logged.

## Candidate Flow

1. Capture still locally with `expo-camera`.
2. Display `Reading title`.
3. Run Apple Vision OCR on guide-assisted regions in this fallback order: primary title crop, expanded title crop, lower title crop, wider title crop, full-card OCR fallback, then manual search if no usable title is found.
4. Display `Finding card`.
5. Search Scryfall by normalized title.
6. Fall back to conservative fuzzy title lookup only when exact title lookup returns nothing.
7. Narrow and rank by set code, collector number, language, and available legal finishes.
8. Show top result, up to two alternatives, raw title OCR, normalized title, collector observations, confidence, and "Why this match?"
9. Require user confirmation before adding to the scanner session or Collection.

## Confidence Limits

- Title OCR is the primary retrieval signal.
- Set code is supporting evidence.
- Collector number is strong exact-printing evidence.
- Language is supporting evidence.
- Title-only OCR is capped below high exact-printing confidence.
- Missing artwork, set symbol, collector info, or finish evidence does not inflate confidence.
- Conflicting set or collector observations remain visible in the explanation.

## Privacy

- Implemented: Captured images stay local.
- Implemented: Captured images are not uploaded to Scryfall or a cloud vision provider.
- Implemented: The temporary `expo-camera` capture is deleted after OCR processing.
- Implemented: Diagnostics show geometry, OCR text, confidence, latency, Scryfall outcome, cleanup status, crop pixel rectangles, winning title attempt, rejected OCR attempt reasons, and local crop-proof overlays only behind `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`; source image paths are not shown.

## Build Requirement

Run a new development build after this branch:

```bash
cd mobile
npx eas build --profile development --platform ios
```

## Autolinking Repair Note

- Implemented: Apple autolinking now resolves the local module as a CocoaPods pod named `TradingDocksVisionOcr`.
- Implemented: `expo-module.config.json` points to `ios/TradingDocksVisionOcr.podspec`; the podspec declares iOS support, `ExpoModulesCore`, Swift source files, and the `TradingDocksVisionOcr` Swift module name.
- Fixed: The previous mismatch was that `expo-modules-autolinking search` discovered the package, but `resolve --platform apple` omitted it because there was no Apple podspec for CocoaPods to link into the iOS binary.
- Requires Production Configuration: Install a clean new iOS development build after this fix; an existing installed binary cannot gain the native module through Metro reload alone.

## Physical iPhone QA

1. Install the new iOS development build.
2. Sign in with a Store or Seller account that can access Scan/Deal Desk workflows.
3. Enable `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true` for diagnostic builds.
4. Open Scan, grant camera permission, and wait for the camera-ready state.
5. Place a known Magic card inside the 63:88 guide.
6. Tap `Capture still`.
7. Confirm `Reading title`, then `Finding card`, then review UI appears.
8. Verify raw OCR title, normalized title, selected title attempt, title crop proof, collector crop proof, parsed set/collector, OCR latency, Scryfall latency, and cleanup status.
9. Verify top-three printings include the expected Scryfall printing.
10. Accept the correct printing and add it to the active scanner session.
11. Confirm running offer/session totals update and missing pricing displays as unavailable, not zero.
12. Fail one scan intentionally, then tap Retake and confirm the camera resumes without requiring `Resume camera`.
13. Retake with glare, sleeve, low light, angled card, and same-name reprint examples.
14. Confirm Android/web show safe unsupported or manual fallback states.
