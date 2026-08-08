# Rapid Scan Pipeline

## Current Status

- Implemented: Trading Docks now defines two scanner throughput modes: Rapid Scan and Precision Scan.
- Implemented: Rapid Scan contracts live in `mobile/services/rapid-scan-pipeline.ts`.
- Implemented: Rapid Scan has a deterministic card-change state machine for Empty, Card Present, Identifying, Identified, Waiting for Change, and New Card.
- Implemented: Rapid Scan suppresses repeated recognition for the same stationary card and rearms when removal or new-card evidence is observed.
- Implemented: Rapid Scan defines a fixed normalized scan zone with title ROI and bottom-left ROI contracts.
- Implemented: Rapid Scan defines a compact local Magic name index and fuzzy title matcher for network-independent name identity.
- Implemented: Rapid Scan confidence routing separates High, Medium, and Low outcomes into append confirmed, append review, continue reading, or Precision fallback.
- Implemented: Rapid Scan result-tray and batch-session helpers keep destination inheritance separate from recognition.
- Implemented: Rapid Scan metrics track frame sampling rate, card-presence latency, title crop latency, OCR latency, local fuzzy match latency, identity latency, printing refinement latency, new-card detection latency, and effective cards per minute.
- Implemented: `TradingDocksVisionOcr.recognizeFrameTitle` accepts a bounded luma frame plus normalized title ROI and returns title text, confidence, and duration without writing a temporary image.
- Implemented: `mobile/services/rapid-scan-live-ocr.ts` controls live title OCR backpressure, stale-result discard, ROI normalization, native OCR result handling, local matching, and Precision fallback.
- Partially Implemented: The active Automatic Scan route displays Rapid Scan as the default throughput mode, hides the still-capture button in Rapid mode, samples live frames into native title ROI OCR, shows recent results as a thin tray, and keeps Precision Scan as the still-capture fallback.
- Partially Implemented: The native camera already feeds bounded luma video frames into the Vision Engine for boundary, quality, card presence, fingerprint, and rearm state.
- Partially Implemented: Live title OCR now exists for iOS development builds, but it depends on a compact in-memory Magic name index. The repository does not yet ship a full MTG name catalog asset, so arbitrary-card coverage requires a catalog packaging sprint.
- Planned: Background exact-printing refinement needs live bottom-left OCR and printing candidate updates connected to session lines.
- Planned: Physical benchmark runs are required before publishing cards-per-minute or accuracy claims.

## Critical Path

Rapid Scan is designed around this critical path:

1. Video frame enters the fixed scan zone.
2. Vision Engine checks card presence, stability, blur, lighting, glare, and card-change evidence.
3. Title ROI is selected instead of OCRing the whole frame.
4. Title OCR output is normalized.
5. Local fuzzy Magic name index resolves identity without Scryfall.
6. High confidence appends a confirmed result; medium confidence appends Review; low confidence continues reading or offers Precision fallback.
7. Printing, image, price, and exact metadata refine in the background.

## Frame Sampling

- Empty state samples card presence at a low target rate.
- Card Present and New Card states increase sampling for fast acquisition.
- Identifying samples title OCR at a controlled rate.
- Waiting for Change suppresses OCR until the card leaves or new-card evidence appears.

The current constants live in `RAPID_SCAN_SAMPLING`. They are engineering targets, not measured device FPS claims.

## Benchmark Protocol

Use a 50-card physical benchmark before changing thresholds:

- Modern, old border, borderless, Secret Lair, retro, foil, sleeved, dark art, light art, long names, short names, and same-name reprints.
- Record identity correctness, exact-printing correctness, review rate, miss rate, median identity latency, p95 identity latency, and cards per minute.
- Do not commit card images or private fixture paths.
- Do not publish accuracy or throughput until the benchmark is run on physical devices.

## Remaining Gaps

- Implemented: Native iOS frame OCR from in-memory luma title ROI.
- Requires Production Configuration: A fresh EAS iOS development/preview build is required before physical QA because the native OCR module API changed.
- Planned: Bottom-left OCR refinement without interrupting preview throughput.
- Planned: Session-line background printing updates.
- Planned: Physical CPU, battery, and thermal testing.
- Planned: Android frame/OCR validation.
