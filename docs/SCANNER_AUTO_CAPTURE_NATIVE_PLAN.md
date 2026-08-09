# Scanner Native Auto-Capture Plan

Status: Partially Implemented.

## Audit Result

Partially Implemented: Trading Docks has a real Vision Engine service in `mobile/services/scanner-vision-engine.ts`. It can evaluate normalized luma frame samples for card presence, boundary, corners, perspective, motion, blur, lighting, glare, stability, removal, FPS, quality, and in-memory region crops.

Implemented: `mobile/services/apple-vision-auto-capture.ts` defines the production auto-shutter state machine and blocks capture when card geometry, stability, quality, or duplicate-removal gates are not satisfied.

Implemented: The active mobile Scan route uses a platform camera adapter. Native builds use a VisionCamera preview and frame output, while Expo Web keeps the Expo Camera fallback.

Implemented: The native adapter feeds bounded native VisionCamera luma samples into the Vision Engine. Diagnostics expose native physical gates only after measured frames arrive. No fake signal, fake FPS, or fake readiness value should be introduced.

Requires Production Configuration: Physical iOS and Android development-build validation is still required before calling hands-free capture production-ready.

## Current Stack

- Implemented: `expo-camera` provides permission handling and the Expo Web fallback.
- Implemented: `react-native-vision-camera`, `react-native-vision-camera-worklets`, `react-native-worklets`, `react-native-nitro-modules`, and `react-native-nitro-image` are installed as the development-build path for native frame delivery.
- Implemented: Synthetic tests cover Vision Engine readiness and same-card removal/rearm behavior.
- Partially Implemented: The active UI enables hands-free capture through bounded frame-signal geometry and the explicit auto-shutter state machine. Physical-device proof is still pending.

## Required Native Implementation

Implemented locally:

1. Replace or wrap the active scanner preview with a development-build VisionCamera component.
2. Add a native frame output that emits bounded luma samples only.
3. Feed those samples into `createScannerVisionEngine`.
4. Update the live guide from measured `ScannerVisionResult.guidance`, `cornerGlow`, `guideTone`, and `captureState`.
5. Call still capture only when `nextAppleVisionAutoCaptureRuntime` reaches a stable Auto ON capture decision.
6. Freeze capture state immediately after a capture and require card removal before rearming.
7. Preserve manual Capture and Manual Search fallbacks.
8. Keep source images and crops in memory only unless the user explicitly opts into benchmark capture.
9. Record measured camera FPS and frame-analysis latency only from native frame delivery.

Requires Production Configuration:

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
