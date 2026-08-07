# Scanner Architecture

## Current Status

- Implemented: Mobile installs SDK-compatible `expo-camera` and configures camera permission copy through the Expo config plugin.
- Implemented: The mobile scanner screen supports permission, denied, unavailable, guided preview, torch toggle, still capture, retake, manual search, exact-printing confirmation, Collection add, Storage assignment, Trade Binder status, Wishlist action, offline queueing, and scanner replay recovery.
- Implemented: Scanner intelligence contracts live in `mobile/services/scanner-intelligence.ts`.
- Implemented: Multi-TCG scanner contracts live in `mobile/services/multi-tcg-scanner.ts`; see `docs/MULTI_TCG_SCANNER.md`.
- Implemented: `mobile/services/magic-recognition-provider.ts` is the first real game-specific recognition adapter. It ranks Magic printings from Scryfall metadata, parsed collector info, name OCR observations, layout/artwork observations when provided, legal finishes, and language compatibility.
- Implemented: Magic scanner calibration tooling validates private fixture manifests, runs local benchmarks, emits sanitized JSON/CSV/Markdown reports, and classifies recognition as recognized, likely, ambiguous, or manual-review required.
- Implemented: The `/dev/scanner-benchmark` route is a feature-flagged development tool for creating private Magic benchmark datasets without hand-editing JSON.
- Implemented: Continuous scanner and offer-session contracts live in `mobile/services/continuous-offer-scanner.ts`; see `docs/CONTINUOUS_SCANNER.md` and `docs/CARD_SHOW_OFFER_SCANNER.md`.
- Implemented: `mobile/services/scanner-vision-engine.ts` is the first replaceable Vision Engine layer. It provides CardBoundary, Perspective, Motion, Blur, Lighting, Glare, CardPresence, CardRemoval, FrameQuality, and RegionExtraction providers for native-fed luma samples.
- Implemented: The Vision Engine detects four corners, aspect ratio, rotation, perspective, fill percentage, center offset, edge visibility, confidence, blur, motion, lighting, glare, distance, stability timing, capture readiness, removal/rearm state, FPS, latency, and in-memory normalized crops for title, artwork, set symbol, collector number, bottom-left, and type-line regions.
- Implemented: `mobile/services/live-card-recognition.ts` now delegates live frame analysis to the Vision Engine, then keeps OCR mapping and Magic adapter handoff separate.
- Implemented: `mobile/modules/trading-docks-vision-ocr` adds a local Expo iOS module backed by Apple Vision `VNRecognizeTextRequest` for captured-still OCR.
- Implemented: `mobile/services/magic-ocr-pipeline.ts` maps the visible guide to captured-image regions, normalizes captured stills to preview orientation, reads title and collector text locally, tries primary/expanded/lower/wide/full-card title OCR fallback regions, queries Scryfall, returns top-three Magic candidates, deletes temporary captures, and caps title-only confidence.
- Implemented: `mobile/services/native-scanner-calibration.ts` defines the native QA diagnostics and calibration contract, including camera-ready gating, guide/crop mapping, unavailable-signal auto-capture blocking, capture outcome labels, card-removal rearm checks, and evidence-only foil diagnostics.
- Implemented: The active Scan screen does not call `takePictureAsync` until `CameraView.onCameraReady` fires.
- Implemented: Scanner Product V3 separates the mobile Scan tab into Scan Modes, Automatic Scan, Single Scan, and Review List. See `docs/SCANNER_PRODUCT_V3.md`.
- Implemented: Automatic Scan now lives at `/scan/automatic` and remains the camera-first hands-free workflow.
- Implemented: Single Scan now lives at `/scan/single` and uses the same captured-still OCR and scanner session contracts for deliberate one-card capture.
- Planned: Grid Scan remains a future route contract only; no fake multi-card route is shipped.
- Implemented: The active Scan screen now uses the premium camera-first hierarchy documented in `docs/SCANNER_PRODUCT_EXPERIENCE.md`: compact header, large camera viewport, Torch/Capture controls, compact result tray, compact session strip, and secondary panels for settings, manual search, and diagnostics.
- Implemented: The active Scan screen uses `mobile/services/scanner-camera-quality.ts` for safe-area-aware guide framing, full-quality still capture options, autofocus, shutter feedback, and iOS responsive captured-still orientation when supported by Expo Camera SDK 54.
- Implemented: Scanner diagnostics are no longer rendered inline in the normal scanner experience; they remain development-only behind `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`.
- Implemented: Physical still captures append an honest session outcome even when identification is unavailable, then preserve manual exact-printing confirmation as the write gate.
- Implemented: The mobile project includes `expo-dev-client`, `react-native-vision-camera`, `react-native-nitro-modules`, and `react-native-nitro-image` as the native-capable development-build path for future high-performance frame delivery.
- Implemented: Scanner replay remains user-scoped and idempotent through generated inventory ids and queue idempotency keys.
- Partially Implemented: Camera capture is local-first and now includes iOS captured-still OCR, but it still does not include benchmarked artwork recognition, set-symbol recognition, perspective correction, Android OCR, or finish classification.
- Partially Implemented: The mobile Scan tab now uses a session-first continuous-intake layout and correct 63:88 card guide, but live auto-capture still needs the VisionCamera frame bridge and physical-device QA before hands-free capture is production-ready.
- Planned: `docs/SCANNER_AUTO_CAPTURE_NATIVE_PLAN.md` defines the native frame-delivery, auto-capture gate, removal/rearm, privacy, QA, and rollback requirements. Do not enable hands-free capture until those gates are met.
- Partially Implemented: The Magic adapter can resolve and explain likely Magic printings from available metadata signals, but it must require user confirmation when exact-printing signals are missing, weak, conflicting, or below threshold.
- Partially Implemented: Pokemon, One Piece, and Lorcana adapters remain replaceable architecture stubs, not benchmarked recognition providers.
- Planned: Artwork matching, set-symbol detection, perspective correction, Android OCR, and foil classification need provider implementations plus benchmarks before any accuracy claim.

## Official Platform Constraints

- Expo Camera: official Expo docs for SDK 54 expose `CameraView`, `useCameraPermissions`, `takePictureAsync`, `enableTorch`, autofocus, and config-plugin permission strings. Photos are saved to app cache when captured, so Trading Docks must delete or avoid retaining them unless the user explicitly saves them. Source: https://docs.expo.dev/versions/v54.0.0/sdk/camera/
- Expo install path: official Expo docs recommend `npx expo install expo-camera` so the installed native module matches the active Expo SDK. Source: https://docs.expo.dev/versions/latest/sdk/camera/
- Expo Router static web: the mobile app uses `web.output: "static"` and `npx expo export --platform web`; scanner code must avoid server-only or browser-only assumptions during static rendering. Source: https://docs.expo.dev/router/web/static-rendering/
- Expo development builds: VisionCamera and Nitro native modules require a custom Expo development build through `expo-dev-client`; this is not an Expo Go workflow.
- Native rebuild requirement: Adding or changing native camera dependencies requires a prebuild/native rebuild before iOS or Android device QA.

## Provider Pipeline

- Implemented: Game detection contracts run before game-specific recognition in the multi-TCG architecture.
- Partially Implemented: `CameraCaptureProvider` still capture exists through `expo-camera`; native continuous frame processing is a development-build integration target.
- Implemented: `CardBoundaryProvider` contract exists, and `live-card-recognition.ts` provides a luma-frame implementation for bounds/corners/quality observations. Perspective correction is represented in the crop contract but is not yet producing a corrected bitmap.
- Partially Implemented: `TextRecognitionProvider` contracts support OCR observations for name, type line, collector info, set code, collector number, language, and rarity. iOS captured-still OCR is implemented through Apple Vision; Android/web remain unsupported and live frame OCR is not connected.
- Partially Implemented: `ArtworkMatchingProvider` contracts support layout and artwork fingerprint observations. No benchmarked artwork-similarity engine is active yet.
- Partially Implemented: `SetSymbolProvider` returns set-symbol contracts only; no production set-symbol recognizer is active yet.
- Implemented: `CollectorInfoProvider` parsing helpers normalize targeted OCR text and parse set code, collector number, language, rarity, and confidence when text observations are supplied.
- Partially Implemented: `FinishDetectionProvider` can evaluate multi-frame finish evidence contracts conservatively; production foil classification remains unbenchmarked.
- Implemented: `PrintingCandidateProvider` ranks possible Scryfall printings.
- Implemented: `ConfidenceFusionProvider` produces explainable overall and per-signal confidence.
- Implemented: Magic confidence output includes overall confidence, top three candidates, per-signal scores for name, set code, collector number, artwork, set symbol, layout, finish compatibility, and language compatibility, conflicts, and "Why this match?" explanation lines.
- Planned: Artwork, set-symbol, finish, and live-frame OCR providers remain replaceable contracts until benchmarked.

## Native Device Calibration

- Implemented: The scanner supports a development-only diagnostics overlay behind `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`; the overlay is hidden when `NODE_ENV` is `production`.
- Implemented: iOS preview/Release builds use `mobile/plugins/with-vision-camera-release-workaround.js` to scope a Swift compiler workaround to the `VisionCamera` pod only. The workaround exists because Xcode 26 / Swift 6.2 can crash compiling VisionCamera V5/Nitro Swift in Release optimization; it does not change scanner UX, OCR behavior, or app-wide optimization.
- Implemented: Diagnostics report camera readiness, scanner lifecycle state, capture ID, preview dimensions, 63:88 guide dimensions, normalized guide crop, capture state, duplicate/removal state, recognition stage, session insertion result, unavailable visual signals, captured-still orientation normalization, OCR crop pixel rectangles, selected/rejected title attempts, Scryfall outcome, and local crop-proof overlays.
- Implemented: Local guide calibration supports scale and vertical offset. These preferences are stored in user-scoped local app storage and are not production configuration.
- Partially Implemented: The guide/crop mapping uses preview geometry from the active screen and handles aspect-fill plus rotated still dimensions. Native camera-frame crop validation still requires physical device testing because `expo-camera` preview scaling and device safe areas vary by platform.
- Planned: Device QA must verify iPhone safe areas, Android preview geometry, sleeves, glare, low light, tilted cards, app resume, tab leave/re-enter, and rapid card replacement before auto-capture can be enabled.

## Multi-TCG Intake

- Implemented: Supported game ids are `magic`, `pokemon`, `one_piece`, `lorcana`, and `unknown`.
- Implemented: Mixed sessions can track consecutive cards from different games, per-game totals, unsupported observations, review counts, and combined or game-separated exports.
- Implemented: Unsupported cards are preserved as unsupported observations and are not forced into the closest supported game.
- Planned: Active scanner UI needs game badges and manual game correction before multi-game writes are enabled.

## Recognition Signals

- Implemented: Region contracts cover full card, name, mana cost, artwork, type line, set symbol, collector info, set code, collector number, language/rarity, and finish evidence.
- Implemented: Confidence fusion weights name OCR, set code, collector number, artwork similarity, set symbol, layout, legal finish compatibility, multi-frame finish evidence, and color/frame cues.
- Implemented: Missing signals remain `null` and do not add positive confidence.
- Implemented: Conflicting low scores are surfaced in `RecognitionConfidence.conflicts`.
- Implemented: Ambiguous resolution returns the top three candidates where available.
- Partially Implemented: The active mobile UI uses manual Scryfall search plus the Magic recognition adapter to show recognized/likely/ambiguous/manual-review states, top alternatives, per-signal confidence, and "Why this match?" details. Visual image recognition is not presented as benchmarked live recognition.

## Confirmation Rules

- Implemented: Exact printing confirmation is required before inventory writes.
- Implemented: Editable confirmation fields include printing, finish, language, condition, quantity, storage location, Trade Binder status, Wishlist action, purchase price contract, and notes contract.
- Planned: Quick-confirm preference can be added later only after confidence thresholds and benchmark data are approved.
- Implemented: The scanner screen renders `RecognitionConfidence.signals`, conflicts through the explanation text, and requires exact-printing confirmation before writing inventory.
- Implemented: The benchmark builder reuses the current Expo Camera capture pattern and design-system primitives, but it saves fixture labels only; it does not add OCR, recognition, or ground-truth inference.

## Destinations

- Implemented: `ScanDestination` separates main Collection, user-created Binder, Trade Binder, named Scan Session, and future Deal Desk handoff.
- Partially Implemented: Main Collection, Storage Location, Trade Binder, and Wishlist writes exist today.
- Partially Implemented: General user-created binders are represented in legacy/public portfolio schema areas, but the mobile scanner does not yet have a production first-class binder assignment mutation.
- Planned: If general binders become a scanner destination, add a migration proposal rather than assuming every binder is the Trade Binder.

## Privacy

- Implemented: Captured frame contracts include `retainedByUser` and `uploadedWithConsent`; defaults are false.
- Implemented: Scanner replay logging avoids tokens, service-role keys, images, and private user data.
- Implemented: The scanner does not upload captured images by default.
- Implemented: Magic recognition sends text metadata queries to Scryfall only; it does not upload captured images, retain captured images by default, or use a paid cloud vision provider.
- Implemented: Live-frame analysis processes local in-memory frame samples and exports metrics plus a fingerprint; source frames are not logged or exported.
- Planned: Remote image-processing providers require explicit consent, HTTPS-only communication, retention controls, and sanitized telemetry rules.

## Remaining Work

- Partially Implemented: iOS captured-still OCR is implemented, but benchmark accuracy is not claimed until product-owner fixtures and physical-device QA are complete.
- Planned: Implement benchmarked artwork providers.
- Planned: Implement perspective correction and robust region cropping against real images.
- Planned: Implement multi-frame foil analysis with glare/sleeve/lighting limitations.
- Planned: Add native physical-device QA for iOS and Android camera permission, torch, capture latency, and cache cleanup.
- Planned: Add saved session export persistence and queued export replay.
## Scanner 2.0 Mobile Shell

Status: Implemented.

The active mobile scan route is `mobile/app/(tabs)/scan.tsx`. It now uses named scanner surfaces while preserving the existing scanner data and provider wiring:

- `ScannerHud`
- `ScannerViewport`
- `ScannerGuide`
- `ScannerControls`
- `ScannerStatus`
- `ScannerResultTray`
- `ScannerSessionStrip`

The working reliability systems remain intact: Expo camera, Apple Vision OCR, Magic title normalization, Scryfall exact/fuzzy lookup, top-three candidates, confidence caps, temporary-image cleanup, session insertion, offer math, manual fallback, diagnostics, user-scoped draft/session persistence, duplicate prevention, and removal/rearm behavior.

Scanner 2.0 adds client-side safeguards for double capture and stale lookup completion. In-flight OCR/Scryfall results are ignored if the route unmounts or a retake invalidates the capture token. Failed recognition no longer pauses the camera; Retake clears stale OCR/candidates and returns to the active camera-ready flow while explicit pause/resume remains user-controlled.

See also: `docs/SCANNER_2_STABILIZATION.md`.
