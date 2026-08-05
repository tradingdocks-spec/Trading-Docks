# Scanner Architecture

## Current Status

- Implemented: Mobile installs SDK-compatible `expo-camera` and configures camera permission copy through the Expo config plugin.
- Implemented: The mobile scanner screen supports permission, denied, unavailable, guided preview, torch toggle, still capture, retake, manual search, exact-printing confirmation, Collection add, Storage assignment, Trade Binder status, Wishlist action, offline queueing, and scanner replay recovery.
- Implemented: Scanner intelligence contracts live in `mobile/services/scanner-intelligence.ts`.
- Implemented: Scanner replay remains user-scoped and idempotent through generated inventory ids and queue idempotency keys.
- Partially Implemented: Camera capture is local-first and does not yet feed a production OCR/artwork/finish recognition provider.
- Planned: OCR, artwork matching, set-symbol detection, collector-info parsing from image crops, perspective correction, and foil classification need provider implementations plus benchmarks before any accuracy claim.

## Official Platform Constraints

- Expo Camera: official Expo docs for SDK 54 expose `CameraView`, `useCameraPermissions`, `takePictureAsync`, `enableTorch`, autofocus, and config-plugin permission strings. Photos are saved to app cache when captured, so Trading Docks must delete or avoid retaining them unless the user explicitly saves them. Source: https://docs.expo.dev/versions/v54.0.0/sdk/camera/
- Expo install path: official Expo docs recommend `npx expo install expo-camera` so the installed native module matches the active Expo SDK. Source: https://docs.expo.dev/versions/latest/sdk/camera/
- Expo Router static web: the mobile app uses `web.output: "static"` and `npx expo export --platform web`; scanner code must avoid server-only or browser-only assumptions during static rendering. Source: https://docs.expo.dev/router/web/static-rendering/

## Provider Pipeline

- Implemented: `CameraCaptureProvider` captures a still and multi-frame finish sequence.
- Implemented: `CardBoundaryProvider` normalizes card orientation and perspective and emits `CardRegion` contracts.
- Implemented: `TextRecognitionProvider` returns OCR observations for name, type line, collector info, set code, collector number, language, and rarity.
- Implemented: `ArtworkMatchingProvider` returns layout and artwork fingerprint observations.
- Implemented: `SetSymbolProvider` returns set symbol and rarity observations.
- Implemented: `CollectorInfoProvider` parses set code, collector number, language, rarity, and confidence.
- Implemented: `FinishDetectionProvider` classifies nonfoil, likely foil, likely etched, special finish candidate, or indeterminate.
- Implemented: `PrintingCandidateProvider` ranks possible Scryfall printings.
- Implemented: `ConfidenceFusionProvider` produces explainable overall and per-signal confidence.
- Planned: Active visual providers are contracts only. They are replaceable and independently testable, but no production OCR/artwork/finish provider is benchmarked yet.

## Recognition Signals

- Implemented: Region contracts cover full card, name, mana cost, artwork, type line, set symbol, collector info, set code, collector number, language/rarity, and finish evidence.
- Implemented: Confidence fusion weights name OCR, set code, collector number, artwork similarity, set symbol, layout, legal finish compatibility, multi-frame finish evidence, and color/frame cues.
- Implemented: Missing signals remain `null` and do not add positive confidence.
- Implemented: Conflicting low scores are surfaced in `RecognitionConfidence.conflicts`.
- Implemented: Ambiguous resolution returns the top three candidates where available.
- Partially Implemented: The active mobile UI still uses manual Scryfall search for writes. Visual recognition output is not presented as live recognition until providers and benchmarks exist.

## Confirmation Rules

- Implemented: Exact printing confirmation is required before inventory writes.
- Implemented: Editable confirmation fields include printing, finish, language, condition, quantity, storage location, Trade Binder status, Wishlist action, purchase price contract, and notes contract.
- Planned: Quick-confirm preference can be added later only after confidence thresholds and benchmark data are approved.
- Planned: A "Why this match?" detail view should render `RecognitionConfidence.signals` and conflicts before any quick-confirm flow ships.

## Destinations

- Implemented: `ScanDestination` separates main Collection, user-created Binder, Trade Binder, named Scan Session, and future Deal Desk handoff.
- Partially Implemented: Main Collection, Storage Location, Trade Binder, and Wishlist writes exist today.
- Partially Implemented: General user-created binders are represented in legacy/public portfolio schema areas, but the mobile scanner does not yet have a production first-class binder assignment mutation.
- Planned: If general binders become a scanner destination, add a migration proposal rather than assuming every binder is the Trade Binder.

## Privacy

- Implemented: Captured frame contracts include `retainedByUser` and `uploadedWithConsent`; defaults are false.
- Implemented: Scanner replay logging avoids tokens, service-role keys, images, and private user data.
- Implemented: The scanner does not upload captured images by default.
- Planned: Remote image-processing providers require explicit consent, HTTPS-only communication, retention controls, and sanitized telemetry rules.

## Remaining Work

- Planned: Implement benchmarked OCR and artwork providers.
- Planned: Implement perspective correction and robust region cropping against real images.
- Planned: Implement multi-frame foil analysis with glare/sleeve/lighting limitations.
- Planned: Add native physical-device QA for iOS and Android camera permission, torch, capture latency, and cache cleanup.
- Planned: Add saved session export persistence and queued export replay.
