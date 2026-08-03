# Trading Docks v245 — Deck Builder Drag, Drop, and Trash

## Deck construction

- Scryfall results are draggable.
- Existing deck cards are draggable.
- Live drop zones:
  - Commander
  - Main Deck
  - Sideboard
  - Considering / Maybeboard
- Duplicate drops increase quantity for the exact printing in that section.
- Mobile users receive direct section buttons beneath every Scryfall result.

## Deck trash

- A large floating trash target appears while an existing deck card is dragged.
- Dropping removes one copy from the decklist only.
- Owned inventory is never deleted.
- Five-second Undo toast restores the removed copy.

## Deck lifecycle

A new Tear Apart / Archive / Delete workflow provides:

- Empty decklist while retaining the deck shell
- Archive the complete deck as Wishlist status
- Permanent deletion with typed deck-name confirmation
- Clear messaging that Inventory records are unaffected

## Persistence

All changes use the existing Deck Vault account-backed autosave and deletion
services. No new Supabase SQL is required.
