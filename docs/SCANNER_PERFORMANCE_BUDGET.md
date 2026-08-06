# Scanner Performance Budget

Status: Partially Implemented.

## Goal

Planned: The scanner should feel instant during card-show and purchase workflows. The target user perception is capture, read, add to Review List, and rearm without waiting for pricing or detailed metadata.

## Current Instrumentation

Implemented: Development diagnostics record a sanitized timing snapshot for the latest batch add:

- capture latency
- OCR latency
- Scryfall lookup latency
- session-write latency
- total scan-to-list latency
- fallback attempt count

Implemented: Diagnostics never include source images, crop images, card photos, tokens, or secrets.

## Current Performance Behavior

Implemented: The active scanner no longer waits for manual Add confirmation after a supported candidate is found.

Implemented: Manual Scryfall searches use an in-memory route cache keyed by normalized query text to avoid duplicate lookups during a scanner session.

Implemented: Pricing is not required before inserting a batch line. Missing prices remain unavailable and are handled in Review List totals.

Implemented: Failed reads do not create session rows and do not perform collection writes.

Partially Implemented: OCR fallback counts are tracked, but deeper provider-level crop timing is not yet benchmarked separately.

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
