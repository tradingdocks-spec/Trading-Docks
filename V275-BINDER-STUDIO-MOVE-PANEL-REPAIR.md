# Trading Docks v275 — Binder Studio move-panel repair

Fixed:

`Cannot find name 'MoveInventoryItemModal'`

The Binder Studio redesign referenced a component name that is not part of this
codebase. The established move-card workflow is implemented by `MoveCardPanel`.

This release:

- Replaces `MoveInventoryItemModal` with `MoveCardPanel`
- Adds the required `currentLocation={location}` prop
- Verifies all Binder Studio helper declarations and invocations
- Preserves the v274 import-header repair
- Preserves the complete Binder Studio redesign
- Preserves Collector Portfolio integration

No new Supabase migration is required.
