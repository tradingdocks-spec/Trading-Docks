# Scanner Benchmark

## Current Status

- Implemented: Benchmark fixture and metrics contracts live in `mobile/services/scanner-intelligence.ts`.
- Implemented: Multi-TCG benchmark fixture and metrics contracts live in `mobile/services/multi-tcg-scanner.ts`; see `docs/MULTI_TCG_BENCHMARK.md`.
- Implemented: Magic benchmark manifest and metrics helpers live in `mobile/services/magic-recognition-provider.ts`.
- Implemented: Magic scanner calibration workflow is documented in `docs/MAGIC_SCANNER_CALIBRATION.md`.
- Implemented: The private benchmark builder route exists at `/dev/scanner-benchmark` and requires `EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER=true`.
- Implemented: The local benchmark command is `npm run benchmark:magic-scanner -- --manifest <private-manifest.json>` from `mobile/`.
- Implemented: Tests assert that benchmark metrics remain `null` until labeled fixtures are actually run.
- Implemented: Native scanner calibration diagnostics can record preview, guide, capture, duplicate, recognition, and session outcome state for physical-device QA without logging source images.
- Implemented: `mobile/services/scanner-benchmark-harness.ts` creates sanitized benchmark run summaries from measured scanner performance samples, including first scan latency, warm scan latency, OCR latency, Scryfall lookup latency, total time until session insertion, camera FPS, preview resolution, capture resolution, fallback count, success rate, review rate, and failure rate.
- Implemented: `mobile/services/scanner-cache-prewarming.ts` provides bounded TTL caches for public catalog lookup terms and prewarming result reporting for OCR, Scryfall lookup cache, camera frame processor, recognition service, and pricing service.
- Implemented: `mobile/services/rapid-scan-pipeline.ts` adds code-level Rapid Scan metrics for frame sampling rate, card-presence detection, title crop, OCR, local fuzzy match, identity latency, printing refinement latency, new-card detection latency, and effective cards per minute.
- Implemented: Rapid Scan benchmark export now includes live OCR frames sampled, OCR start/end counts, skipped frames, stale discards, last OCR duration, local match duration, identity latency, frame-to-result latency, raw/normalized OCR text, match score/band, failure stage, ROI, Vision ROI, frame orientation, and local catalog readiness/count/prewarm timing.
- Implemented: `mobile/services/scanner-multi-signal-recognition.ts` includes a benchmark comparison contract for OCR-only, visual-fingerprint plus OCR, and compact-embedding plus OCR approaches without inventing unavailable embedding measurements.
- Implemented: Rapid Scan and Single Scan now emit active multi-signal diagnostics for geometry, descriptor generation, visual lookup, OCR, fusion, identity, and printing-refinement timing buckets. These are measured only when the physical scanner runs; documentation must not substitute estimates.
- Partially Implemented: The bundled visual descriptor seed contains 9 regression records and is small enough for offline startup validation. It is not a full artwork benchmark corpus.
- Implemented: The default still-capture Scryfall lookup path uses a bounded, non-user-data cache keyed by normalized card name, set code, and collector number.
- Partially Implemented: Magic has a fixture-driven benchmark runner, report serializers, threshold classes, private local fixture manifest validation, development-only fixture builder, and calibration recommendations, but no labeled Magic-only image dataset has been supplied or executed in this repository.
- Planned: No game-specific visual fixture dataset or mixed-stack image dataset has been run against the scanner in this repository.
- Planned: Do not publish scanner accuracy, foil accuracy, latency, manual-correction, or failure-rate numbers until the benchmark runner has processed reviewed fixtures.
- Planned: Continuous auto-capture thresholds for boundary, motion, blur, glare, lighting, and stability must be benchmarked with real card-show fixture footage before reducing confirmation requirements.
- Partially Implemented: `mobile/services/live-card-recognition.ts` has synthetic tests for boundary, aspect ratio, partial-card rejection, blur, motion, glare, lighting, auto-capture readiness, OCR mapping, and conflict handling. These tests validate code behavior, not real-world camera accuracy.

## Fixture Categories

- Planned: Modern frame.
- Planned: Old border.
- Planned: Borderless.
- Planned: Extended art.
- Planned: Showcase.
- Planned: Retro frame.
- Planned: Foil.
- Planned: Etched foil.
- Planned: Sleeved card.
- Planned: Glare.
- Planned: Low light.
- Planned: Angled card.
- Planned: Foreign language.
- Planned: Double-faced card.
- Planned: Damaged card.
- Planned: Token.
- Planned: Similar artwork reprints.
- Planned: Same name across many sets.

## Metrics

- Implemented: Magic benchmark metrics can calculate correct card name top-1, correct printing top-1, correct printing top-3, average latency, manual-confirmation/correction proxy, failure rate, and fixture count once local results are supplied.
- Implemented: Magic benchmark reports include false high-confidence rate, average confidence, finish accuracy where supported, unsupported-card rejection rate, and manual-confirmation requirement.
- Implemented: Development scanner benchmark summaries can export measured first-scan latency, warm-scan latency, OCR latency, Scryfall lookup latency, total-until-session-insertion latency, effective camera FPS, preview resolution, capture resolution, OCR fallback count, success/failure rate, and review rate without source images or source image paths.
- Planned: Correct card name top-1 for non-Magic games.
- Planned: Correct printing top-1 for non-Magic games.
- Planned: Correct printing top-3 for non-Magic games.
- Planned: Foil classification accuracy.
- Planned: False foil rate.
- Planned: Average scan latency.
- Planned: Manual correction rate.
- Planned: Failure rate.
- Planned: Live-frame analyzer latency on physical iOS and Android development builds.
- Planned: Rapid Scan physical benchmarks must report identity latency, review rate, miss rate, same-card suppression, new-card rearm latency, and cards per minute from real card handling.
- Planned: Physical-device Rapid Scan QA must verify the diagnostic title ROI overlay aligns with the printed title area before using latency or miss-rate results for threshold decisions.
- Planned: Multi-signal physical benchmarks must report identity accuracy, printing accuracy, review rate, miss rate, median recognition latency, p95 recognition latency, cards per minute, and false high-confidence rate for the regression set including Incinerate, Goblin War Strike, Lightning Bolt, Sol Ring, Birds of Paradise, Rhystic Study, Runed Stalactite, Krark-Clan Ironworks, and Ulalek, Fused Atrocity. Compare OCR-only, visual-fingerprint plus OCR, and any future compact embedding plus OCR only when all paths are actually measured.
- Requires Production Configuration: Live OCR benchmark runs require a fresh iOS development/preview build because the native OCR module API changed.
- Planned: Auto-capture false-positive and false-negative rates using real fixture footage.
- Planned: Native guide/crop alignment, camera-ready timing, card-removal rearm, duplicate suppression, and app-resume behavior must be recorded in `docs/NATIVE_SCANNER_QA.md` before hands-free capture is treated as operational.

## Benchmark Rules

- Do not use screenshots or captured card photos without permission.
- Do not store benchmark images in the repository unless licensing and privacy review approve them.
- Magic fixture images should live in a private local directory referenced by manifest metadata, not in Git.
- `mobile/fixtures/private-scanner/`, `mobile/fixtures/magic-scanner-private/`, and `mobile/benchmark-output/` are ignored by Git.
- Generated benchmark reports must not include source image paths or filenames.
- Development scanner benchmark harness exports are sanitized JSON/Markdown summaries only. They do not include source images, image filenames, file URIs, or local Windows paths.
- The builder must be disabled in production builds and must not appear in normal navigation.
- Every fixture must record expected name, expected printing identifiers when known, expected finish when relevant, lighting/sleeve notes, and frame URIs.
- Accuracy reports must include fixture count, fixture mix, provider versions, device models, lighting notes, and date run.
- Foil benchmarks must include nonfoil glare cases so the false foil rate is measurable.
- Similar reprint benchmarks must include same-name multi-set cards and similar artwork variants.

## Rollout Gate

- Planned: A scanner provider can move from architecture/stub to production candidate only after it runs the benchmark and the product owner accepts thresholds for manual confirmation, quick-confirm eligibility, and fallback behavior.
- Requires Production Configuration: Product owner must approve fixture mix, threshold targets, device list, acceptable false high-confidence rate, and whether OCR/image processing can use native-only dependencies before visual recognition is marketed as production-ready.
- Requires Production Configuration: Physical-device benchmarks must be run from a custom development build because VisionCamera/Nitro frame processing is not available in Expo Go.
