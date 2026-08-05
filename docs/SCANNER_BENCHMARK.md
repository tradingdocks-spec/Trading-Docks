# Scanner Benchmark

## Current Status

- Implemented: Benchmark fixture and metrics contracts live in `mobile/services/scanner-intelligence.ts`.
- Implemented: Tests assert that benchmark metrics remain `null` until labeled fixtures are actually run.
- Planned: No labeled image dataset has been collected or executed.
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

- Planned: Correct card name top-1.
- Planned: Correct printing top-1.
- Planned: Correct printing top-3.
- Planned: Foil classification accuracy.
- Planned: False foil rate.
- Planned: Average scan latency.
- Planned: Manual correction rate.
- Planned: Failure rate.

## Benchmark Rules

- Do not use screenshots or captured card photos without permission.
- Do not store benchmark images in the repository unless licensing and privacy review approve them.
- Every fixture must record expected name, expected printing identifiers when known, expected finish when relevant, lighting/sleeve notes, and frame URIs.
- Accuracy reports must include fixture count, fixture mix, provider versions, device models, lighting notes, and date run.
- Foil benchmarks must include nonfoil glare cases so the false foil rate is measurable.
- Similar reprint benchmarks must include same-name multi-set cards and similar artwork variants.

## Rollout Gate

- Planned: A scanner provider can move from architecture/stub to production candidate only after it runs the benchmark and the product owner accepts thresholds for manual confirmation, quick-confirm eligibility, and fallback behavior.
