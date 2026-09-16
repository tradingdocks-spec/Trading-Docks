# Chaos Sort flagship direction

Chaos Sort should become the physical inventory map for Trading Docks. Its promise is simple: a seller can put a card into a small, traceable physical batch without alphabetizing a room, and a future pick can resolve from card identity to an exact location.

## Product promise

`Recognize → stage → batch → locate → label → pick` is the core loop. Recognition is an input, not the product. The durable value is the relationship between a physical card, its batch, its location, and its movement history.

The normal scan view should be glanceable from several feet away:

- session and active batch code;
- cards in the batch against a configurable target (default 100);
- ready, review, and unknown counts;
- the last recognized card;
- one clear action to finish the batch.

Failures remain in a review queue so one bad recognition does not stop intake. A batch may close above or below target; target is guidance, never a hard inventory limit.

## Durable model

The system separates the intake job from the physical bundle:

`Chaos Sort session → batch → inventory position → inventory event`

A session captures source, acquisition reference, defaults, and total throughput. A batch is an immutable physical identity with a generated code, target quantity, destination, and lifecycle. An inventory position preserves the physical split even when the collection UI aggregates identical printings. Inventory events record creation, movement, pick, adjustment, and retirement.

Existing inventory must never be collapsed into a single quantity when a new batch arrives. The aggregate may display ten copies, while the authoritative positions remain seven existing copies plus three copies in the new batch and location.

## Batch state machine

`draft → scanning → review → ready_to_commit → committed`

`review → failed` is reserved for recoverable persistence failures. A committed batch is immutable; later movement creates an event and a new location assignment. A retry uses the session and batch idempotency key and must not create a second batch or duplicate inventory positions.

## Location workflow

Locations are user-defined and may be flat (`BIN-A042`) or nested (`Rack A / Shelf 03 / Box 07`). The worker chooses a destination once per batch, preferably by scanning a permanent location QR label. The batch label then contains the batch code, location, card count, and a QR link to the batch detail page.

## Delivery slices

1. **Operator loop:** session start, active batch meter, continuous review queue, finish-and-assign destination, and automatic next batch.
2. **Authoritative persistence:** session/batch tables, location-aware inventory positions, idempotent commit boundary, and immutable inventory events.
3. **Retrieval:** batch detail, location detail, pick mode, move batch, and audit history.
4. **Hardware and optimization:** printable thermal labels, location recommendations, low-volume consolidation, and scan-to-move.

The first slice should be usable without a printer or a perfect recognition provider. It must still produce correct provenance and make the next physical action obvious.

## Guardrails

- Never require exactly 100 cards.
- Never let unresolved cards silently enter inventory.
- Never reuse a batch code.
- Never turn a failed persistence response into a success state.
- Never erase batch provenance when quantities are aggregated, sold, moved, or consolidated.
- Keep provider outages in the review queue and show an actionable reason.
