# Scanner Consumer Performance

Status: Partially Implemented

## Performance Goal

The scanner should prioritize consumer throughput:

`camera frame > card identity candidate > review/add > background enrichment`

Price, image, collector OCR, and secondary metadata must not block the user when identity is already sufficient for review. If identity is not sufficient, the scanner must ask for confirmation rather than invent certainty.

## Current Fast Path

- Implemented: Scanner Review List separates capture/intake from final collection write.
- Implemented: Failed reads do not create unknown inventory rows.
- Implemented: Price enrichment runs after Review List insertion when Scryfall price metadata is available.
- Implemented: Automatic Scan now allows the current ready vision frame to trigger capture before same-card removal state blocks the next scan.
- Partially Implemented: Physical-device benchmark numbers are not available from repository-only validation.

## Automatic Scan State Machine

Current state order:

1. Frame analysis receives card-presence and quality signals.
2. Readiness resolves user-facing guidance.
3. Auto-capture checks camera/session/process gates.
4. The current ready vision frame may trigger capture.
5. Capture freezes and sends the image through OCR and lookup.
6. Successful intake enters Review List.
7. Same-card protection requires removal before rearming.

## Measurements

Requires Physical Measurement:

- Average scan time.
- OCR time.
- Scryfall lookup time.
- Total time until session insertion.
- Camera FPS.
- Preview resolution.
- Capture resolution.

Do not estimate these values. Record them from the development diagnostics panel or a dedicated physical benchmark run.

## Remaining Risks

- Partially Implemented: Native frame delivery and auto-capture behavior still require iOS and Android development-build QA.
- Planned: Add measured budgets for sleeves, glare, low light, damaged cards, and rapid replacement.
- Planned: Add a documented pass/fail threshold before relaxing confirmation requirements.
