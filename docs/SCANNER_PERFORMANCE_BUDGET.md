# Scanner Performance Budget

Status: Partially Implemented.

## Goal

Planned: The scanner should feel instant during card-show and purchase workflows. The target user perception is capture, read, add to Review List, and rearm without waiting for pricing or detailed metadata.

## Current Instrumentation

Implemented: Development diagnostics record sanitized timing snapshots for recent batch adds:

- capture latency
- OCR latency
- Scryfall lookup latency
- session-write latency
- total scan-to-list latency
- fallback attempt count
- preview resolution when available
- capture resolution when available

Implemented: Diagnostics never include source images, crop images, card photos, tokens, or secrets.

Implemented: `mobile/services/scanner-performance-instrumentation.ts` keeps a bounded 20-sample local history behind `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS=true`, computes measured averages only from real samples, and exports sanitized JSON from the development diagnostics sheet.

Partially Implemented: Camera FPS is represented in the report contract, but Expo Camera does not currently provide a measured live FPS value in the active route. Reports mark FPS unavailable rather than estimating it.

## Current Performance Behavior

Implemented: The active scanner no longer waits for manual Add confirmation after a supported candidate is found.

Implemented: Manual Scryfall searches use an in-memory route cache keyed by normalized query text to avoid duplicate lookups during a scanner session.

Implemented: Pricing is not required before inserting a batch line. Scryfall price enrichment runs asynchronously after insertion and updates the matching Review List row only when a positive exact-printing price is available. Missing prices remain unavailable and are handled in Review List totals.

Implemented: Failed reads do not create session rows and do not perform collection writes.

Partially Implemented: OCR fallback counts are tracked, but deeper provider-level crop timing is not yet benchmarked separately.

Partially Implemented: Repository validation can prove the instrumentation path and export format, but physical-device measurements for average scan time, preview resolution, capture resolution, and camera FPS still require iOS and Android development-build QA.

## Budget Targets

Planned:

- Capture: under 350 ms after shutter call on supported devices.
- OCR: under 900 ms for the selected region set.
- Scryfall lookup: under 700 ms on healthy network.
- Session write: under 50 ms local state update.
- Scan-to-list total: under 2 seconds for assisted recognition.
- Manual search repeat query: served from route cache.

Requires Production Configuration: These targets require physical iPhone and Android benchmark runs before they can be marked Implemented.

## Bottleneck Watchlist

Partially Implemented: The largest expected bottlenecks remain native OCR latency, repeated Scryfall lookup under poor network, camera capture latency on older devices, and future artwork/finish enrichment.

Planned: Add persisted catalog caching, query cancellation, provider-level timing, and physical-device benchmark reports before reducing confirmation requirements further.
