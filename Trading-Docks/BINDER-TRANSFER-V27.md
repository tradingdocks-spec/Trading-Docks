# Binder transfer reliability — v27

This release fixes cards becoming invisible after a Box → Binder move.

## Fixes

- Every move into a binder now resolves and validates a real page and pocket.
- Moves started from a box row, box detail panel, or bulk action automatically use the first available pocket.
- Moves started from the binder management panel honor the selected pocket and reject occupied or invalid pockets.
- A full binder cancels the move and leaves the source card unchanged.
- Consecutive and bulk moves use the latest inventory state, preventing two cards from receiving the same pocket.
- Existing card records stranded in a binder without a page or pocket are automatically recovered into open pockets.
- Non-binder moves still clear stale binder coordinates.
- Matching records may combine only at non-binder destinations.

No inventory record is deleted during a binder transfer.
