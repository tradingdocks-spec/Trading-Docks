# Scanner Benchmark

## Current Status

- Implemented: Benchmark fixture and metrics contracts live in `mobile/services/scanner-intelligence.ts`.
- Implemented: Multi-TCG benchmark fixture and metrics contracts live in `mobile/services/multi-tcg-scanner.ts`; see `docs/MULTI_TCG_BENCHMARK.md`.
- Implemented: Magic benchmark manifest and metrics helpers live in `mobile/services/magic-recognition-provider.ts`.
- Implemented: Magic scanner calibration workflow is documented in `docs/MAGIC_SCANNER_CALIBRATION.md`.
- Implemented: The local benchmark command is `npm run benchmark:magic-scanner -- --manifest <private-manifest.json>` from `mobile/`.
- Implemented: Tests assert that benchmark metrics remain `null` until labeled fixtures are actually run.
- Partially Implemented: Magic has a fixture-driven benchmark runner, report serializers, threshold classes, private local fixture manifest validation, and calibration recommendations, but no labeled Magic-only image dataset has been supplied or executed in this repository.
- Planned: No game-specific visual fixture dataset or mixed-stack image dataset has been run against the scanner in this repository.
- Planned: Do not publish scanner accuracy, foil accuracy, latency, manual-correction, or failure-rate numbers until the benchmark runner has processed reviewed fixtures.

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
- Planned: Correct card name top-1 for non-Magic games.
- Planned: Correct printing top-1 for non-Magic games.
- Planned: Correct printing top-3 for non-Magic games.
- Planned: Foil classification accuracy.
- Planned: False foil rate.
- Planned: Average scan latency.
- Planned: Manual correction rate.
- Planned: Failure rate.

## Benchmark Rules

- Do not use screenshots or captured card photos without permission.
- Do not store benchmark images in the repository unless licensing and privacy review approve them.
- Magic fixture images should live in a private local directory referenced by manifest metadata, not in Git.
- `mobile/fixtures/private-scanner/`, `mobile/fixtures/magic-scanner-private/`, and `mobile/benchmark-output/` are ignored by Git.
- Generated benchmark reports must not include source image paths or filenames.
- Every fixture must record expected name, expected printing identifiers when known, expected finish when relevant, lighting/sleeve notes, and frame URIs.
- Accuracy reports must include fixture count, fixture mix, provider versions, device models, lighting notes, and date run.
- Foil benchmarks must include nonfoil glare cases so the false foil rate is measurable.
- Similar reprint benchmarks must include same-name multi-set cards and similar artwork variants.

## Rollout Gate

- Planned: A scanner provider can move from architecture/stub to production candidate only after it runs the benchmark and the product owner accepts thresholds for manual confirmation, quick-confirm eligibility, and fallback behavior.
- Requires Production Configuration: Product owner must approve fixture mix, threshold targets, device list, acceptable false high-confidence rate, and whether OCR/image processing can use native-only dependencies before visual recognition is marketed as production-ready.
