# Multi-TCG Benchmark

## Current Status

- Implemented: Multi-TCG benchmark fixture and metrics contracts live in `mobile/services/multi-tcg-scanner.ts`.
- Implemented: Metrics remain `null` until labeled fixtures are actually run.
- Planned: No game-specific or mixed-stack labeled benchmark dataset exists yet.
- Planned: Do not publish game-detection, exact-printing, finish, unsupported-card, latency, or correction-rate numbers until benchmark runs are complete.

## Fixture Categories

- Planned: Game detection.
- Planned: Card name.
- Planned: Exact printing.
- Planned: Finish.
- Planned: Language.
- Planned: Unsupported cards.
- Planned: Mixed stack.

## Required Games

- Planned: Magic fixtures.
- Planned: Pokemon fixtures.
- Planned: One Piece fixtures.
- Planned: Lorcana fixtures.
- Planned: Unknown/unsupported fixtures that should be rejected.

## Metrics

- Planned: Game top-1.
- Planned: Game top-2.
- Planned: Exact printing top-1.
- Planned: Exact printing top-3.
- Planned: Finish accuracy.
- Planned: False foil rate.
- Planned: Unsupported-card rejection.
- Planned: Latency.
- Planned: Correction rate.

## Rules

- Fixtures must identify expected game, expected card name when known, expected external id when known, expected finish when relevant, and labeled frame URIs.
- Mixed-stack benchmarks must include consecutive cards from different games.
- Unsupported-card fixtures must include non-supported TCGs and non-card items so the scanner learns to reject rather than force a match.
- Accuracy reporting must include fixture count, game mix, device, provider versions, catalog versions, lighting notes, and date run.
- Benchmark media must not be committed without licensing and privacy approval.
