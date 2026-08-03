# Trading Docks v256 — Deck trash and condensed hover fix

- Removed obsolete condensed floating-preview code and `setHoveredCard`.
- Condensed hover now updates only the right-side Card Inspector.
- Preserved valid table-view preview positioning.
- Added a visible trash icon to condensed card rows.
- Added an Undo-enabled trash action to the Card Inspector.
- Drag-to-trash remains active.
- Removing a card subtracts one copy only.
- Owned Inventory is never deleted.

No Supabase migration is required.
