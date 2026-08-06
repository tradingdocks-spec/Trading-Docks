# Scanner Native Auto-Capture Plan

Status: Planned.

## Audit Result

Partially Implemented: Trading Docks has a real Vision Engine service in `mobile/services/scanner-vision-engine.ts`. It can evaluate normalized luma frame samples for card presence, boundary, corners, perspective, motion, blur, lighting, glare, stability, removal, FPS, quality, and in-memory region crops.

Partially Implemented: `mobile/services/native-scanner-calibration.ts` defines the safety gate for native auto-capture and blocks capture when required physical signals are unavailable.

Partially Implemented: The active mobile Scan route still uses Expo Camera `CameraView` still capture. It does not yet feed live VisionCamera frames into the Vision Engine.

Implemented: The active route passes `NO_NATIVE_VISUAL_SIGNALS` into diagnostics, so repository-supported auto-capture must remain disabled. No fake signal, fake FPS, or fake readiness value should be introduced.

## Current Stack

- Implemented: `expo-camera` provides permission handling, preview, torch, `onCameraReady`, and manual `takePictureAsync`.
- Implemented: `react-native-vision-camera`, `react-native-nitro-modules`, and `react-native-nitro-image` are installed as the development-build path for native frame delivery.
- Implemented: Synthetic tests cover Vision Engine readiness and same-card removal/rearm behavior.
- Planned: The active UI needs a VisionCamera-backed frame source before hands-free capture can be enabled.

## Required Native Implementation

Planned:

1. Replace or wrap the active scanner preview with a development-build VisionCamera component.
2. Add a native frame processor that emits bounded luma samples or approved native observations only.
3. Feed those samples into `createScannerVisionEngine`.
4. Update the live guide from measured `ScannerVisionResult.guidance`, `cornerGlow`, `guideTone`, and `captureState`.
5. Call still capture only when `canAutoCaptureNative` returns ready and `ScannerVisionResult.shouldCapture` is true.
6. Freeze capture state immediately after a capture and require card removal before rearming.
7. Preserve manual Capture and Manual Search fallbacks.
8. Keep source images and crops in memory only unless the user explicitly opts into benchmark capture.
9. Record measured camera FPS and frame-analysis latency only from native frame delivery.
10. Validate on physical iOS and Android development builds before changing confirmation friction.

## Acceptance Criteria

Requires Production Configuration:

- Physical iOS and Android tests confirm stable frame delivery.
- Real camera FPS is measured, not estimated.
- Preview geometry matches still-capture crop geometry.
- Auto-capture does not fire while camera is warming, app is backgrounded, user paused, or a sheet is open.
- Same stationary card cannot scan twice.
- Removal/rearm behavior works with sleeves, glare, low light, angled cards, and rapid card replacement.
- Failed recognition returns to manual recovery without adding an unknown card.

## Rollback

Implemented: The current manual still-capture path is the fallback. Any native auto-capture implementation must be feature-gated until physical QA passes and can be disabled without changing scanner session, OCR, or Review List behavior.
