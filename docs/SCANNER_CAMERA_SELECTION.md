# Scanner Camera Selection

Status: Partially Implemented.

## Current Contract

- Implemented: Mobile scanner camera mode is separate from digital zoom. The active user modes are `auto`, `close`, `standard`, and `telephoto`.
- Implemented: Legacy stored `macro` preferences normalize to `close`.
- Implemented: User-facing labels are Auto, Close-up, Standard, and Telephoto. Short labels are Auto, Close, Std, and Tele.
- Implemented: Unsupported camera modes are hidden from normal scanner controls.
- Implemented: Fixed modes that map to the same physical rear camera as another fixed mode are hidden to avoid no-op switches.
- Implemented: Raw camera ids remain development-only in Camera Inspector and Camera QA.
- Partially Implemented: Actual physical camera discovery can only be verified on a VisionCamera native build. Repository tests use synthetic VisionCamera-like device records.

## Selection Rules

- Auto scores rear cameras by focus support, torch, close-focus distance, optical type, non-virtual device exposure, and photo resolution.
- Close-up prefers an actual non-virtual short-focus rear camera. If focus distance is not exposed, it falls back to an actual ultra-wide camera when VisionCamera exposes one.
- Standard prefers an actual non-virtual wide-angle rear camera.
- Telephoto requires an exposed telephoto rear camera and is hidden when unavailable.
- Virtual multi-camera devices are supported, but iOS may not expose a way to force the physical lens inside a virtual device. When fixed modes collapse to the same device, duplicate normal controls are hidden and the limitation is visible in development diagnostics.

## Switch Lifecycle

- Implemented: Camera mode switches invalidate live frame analysis, clear active capture/search ids, block auto-capture by marking the camera not ready, clear current vision output, clear focus reticle, and preserve the active scanner session.
- Implemented: `ScannerCamera` remounts when the resolved device/profile key changes.
- Implemented: Mode-specific quality profiles choose still and frame-output targets without pretending digital zoom is a lens switch.
- Implemented: Torch state is reconciled against the new device's `hasTorch` value.
- Implemented: Stale frames captured before the switch completes are ignored.

## Development QA

- Implemented: Camera QA shows selected mode, selected device name/id, physical device types, neutral/min/max zoom, minimum focus distance, torch support, focus support, selected format, target photo/frame resolution, actual session resolution when VisionCamera reports it, and effective FPS.
- Implemented: Development diagnostics expose a Cycle cameras action that logs old mode/device, new mode/device, and switch readiness timing without exposing raw ids to normal users.
- Requires Production Configuration: Physical iOS and Android development builds must record actual discovered camera modes before release claims are made.

## Validation Notes

- Implemented: Focused tests cover unique mode mapping, duplicate fixed-mode hiding, Auto/Close/Standard/Tele scoring, unsupported Telephoto hiding, selected device changes, mode-specific format changes, stale frame ignoring, switch-time auto-capture blocking, session preservation, torch preservation, and preference normalization.
- Partially Implemented: No actual device inventory was available in this repository run. Actual discovered mode-device mappings must come from the development Camera QA route on target hardware.
