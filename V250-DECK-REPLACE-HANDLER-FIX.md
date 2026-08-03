# Trading Docks v250 — Deck replacement handler fix

Fixed the Vercel TypeScript error:

`Cannot find name 'replaceCard'`

The replacement modal still legitimately uses card replacement. A typed handler
has been restored.

The handler:

- Replaces the selected card with the selected Scryfall printing
- Preserves quantity
- Preserves deck section
- Preserves Commander status
- Updates commander art and name when needed
- Recalculates category for non-Commander cards
- Uses the existing autosave flow

All prior Deck Builder features remain included.
