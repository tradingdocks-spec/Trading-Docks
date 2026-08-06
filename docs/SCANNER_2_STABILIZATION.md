# Scanner 2.0 Stabilization

Status: Implemented as the current Scanner 2.0 reliability contract.

## Wave 3 Recovery Update

- Implemented: Scanner Recovery now uses one concise recovery message per queued add, clear retry/discard actions, and shared TD state/list primitives.
- Implemented: Normal recovery UI no longer exposes idempotency keys; those details remain diagnostic/developer concerns.
- Implemented: The scanner recovery matrix in `docs/MOBILE_VISUAL_MIGRATION_WAVE_3.md` documents no-title, no-match, network failure, service failure, camera denied, camera unavailable, capture failed, stale result, duplicate stationary card, and explicit pause behavior.
- Requires Production Configuration: Native camera/OCR behavior still requires physical-device QA with the OCR-capable development build.

## Scope

This stabilization pass keeps the current Scanner 2.0 design and provider stack. It does not replace Apple Vision OCR, change native module names, add new TCG adapters, claim benchmark accuracy, retain images by default, or change billing, memberships, schemas, or production configuration.

## Canonical Camera Lifecycle

Implemented: The route derives camera behavior from one lifecycle model in `mobile/services/premium-scanner-experience.ts`:

- `permission_pending`
- `unavailable`
- `starting`
- `ready`
- `user_paused`
- `processing_paused`
- `backgrounded`
- `error`

Implemented: `ready` is the only lifecycle state that can start capture. `user_paused` is the only state that shows Resume camera. Failed recognition and processing completion do not set user pause.

Implemented: App backgrounding invalidates the active capture token and stops camera rendering. Foregrounding restores the camera when permission is granted and the user did not explicitly pause.

## Crop Mapping

Implemented: `mobile/services/magic-ocr-pipeline.ts` owns the canonical preview-to-capture mapping. It maps:

1. preview-space guide
2. aspect-fill visible preview image
3. captured still dimensions
4. normalized orientation
5. card crop
6. title crop variants
7. collector crop

Implemented: The mapper handles horizontal and vertical aspect-fill offsets, rotated iPhone still dimensions, clamping, guide-near-edge cases, and pixel rectangle diagnostics.

Partially Implemented: This is still guide-assisted rectangle mapping, not four-corner perspective correction.

## OCR Fallback Order

Implemented: Apple Vision receives these local OCR regions in order:

1. primary title strip
2. expanded title strip
3. slightly lower title strip
4. wider title strip
5. full-card OCR fallback
6. manual search

Implemented: Each attempt preserves raw text, normalized text, confidence, bounds, score, and selected or rejected reason. Normalization trims, collapses whitespace, preserves apostrophes, hyphens, and commas, removes isolated symbols, rejects numeric-only and one-character noise, and creates conservative OCR-confusion alternatives without overwriting raw text.

## Scryfall Outcomes

Implemented: Lookup diagnostics classify outcomes as:

- `success`
- `no_title`
- `no_match`
- `network_unavailable`
- `service_error`
- `invalid_response`
- `cancelled`

Implemented: Title-only OCR can still return candidates, and confidence stays capped without exact-printing evidence. Missing collector info does not force failure.

## Retry And Cancellation

Implemented: Still capture uses a capture ID. Retake, unmount, or app background invalidates the active capture so stale OCR/Scryfall completions cannot overwrite the current screen.

Implemented: Manual search uses a search ID so stale Scryfall results cannot overwrite newer searches.

Implemented: Retake clears OCR, normalized title, candidates, selected result, result tray, user-facing error, development crop previews, and capture ID while preserving the scanner session and resuming the camera unless the app is backgrounded.

Planned: A network-only retry button for a valid OCR title can be added after physical QA verifies the current failed-state flow.

## Main Screen Simplification

Implemented: The active Scan tab keeps only the compact two-line header, dominant camera viewport, one instruction, Torch/Capture/Search controls, compact result tray, compact session strip, and bottom navigation on the primary surface.

Implemented: Pause and settings are compact header actions. Diagnostics opens from scanner settings and remains unavailable unless `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`.

Implemented: Failed recognition renders one compact recovery banner only. It excludes pricing, quantity, review badges, placeholder thumbnails, session metadata, and technical lookup details.

## Diagnostics

Implemented: Diagnostics are unavailable unless `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`. They are not rendered inline in normal scanner mode.

Implemented diagnostics include:

- native OCR linked status
- scanner lifecycle state
- capture ID
- preview dimensions
- captured image dimensions
- source and normalized orientation
- guide rectangle
- mapped card crop
- primary, expanded, lower, wide, and full-card title crop rectangles
- collector crop rectangle
- crop pixel sizes
- OCR attempts and reasons
- selected OCR attempt
- raw title
- normalized title
- OCR confidence and latency
- Scryfall query, status, outcome, candidate count, and top-three ranking
- cleanup result

Implemented: Dev-only crop proof shows local full image, card crop, title crop variants, and collector crop overlays. Source image paths are not displayed or logged. Temporary stills are deleted when diagnostics closes or cleanup runs.

## Session Rules

Implemented: Failed scans do not create unknown session rows. A card enters the active session only after the user accepts or corrects a candidate. Missing price remains unavailable and is not treated as zero in offer totals.

Implemented: One accepted capture creates one session line through the existing session contract. Retake preserves the session and does not duplicate accepted rows.

## Physical QA Checklist

Requires Production Configuration: Run these on a clean iOS development build:

- readable Magic card such as Sporecrown Thallid
- long title
- old border
- borderless
- sleeved card
- glare
- low light
- angled card
- title partially obscured
- repeated retake
- app background and foreground
- airplane mode
- same-name reprint
- five-card session
- ten-card session

Do not hardcode these cards or fixture names in production logic.

## Remaining Limitations

- Partially Implemented: OCR accuracy is not benchmarked.
- Partially Implemented: Artwork matching, set-symbol recognition, perspective correction, Android OCR, and foil classification remain future provider work.
- Partially Implemented: Network-only lookup retry from a preserved OCR title remains a small follow-up after device QA.
- Requires Production Configuration: Physical iPhone QA is required before this scanner path is called production-ready.
