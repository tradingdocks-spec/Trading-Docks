# Trading Docks Deck Vault — Responsive Import V14

## Deck table
- Removed horizontal table scrolling.
- The table now uses a fixed responsive layout.
- Card type and role are combined beneath the card name at normal desktop widths.
- The separate Type column appears only on very wide displays.
- Quantity, mana value, price, and status use compact fixed widths.
- Vertical scrolling remains available for long decks.

## Mana symbols
- All five basic-land buttons now use identical fixed symbol containers.
- Symbols are normalized to the same visual size.
- Missing external symbols gracefully fall back to a clearly colored W, U, B, R, G, or C marker.
- Black and red symbols can no longer collapse or disappear without a visible replacement.

## Commander during import
- Added a commander search and selection area directly on the import page.
- Searches valid legendary commander candidates through the existing Scryfall-backed search route.
- The selected commander is forced into the standalone commander slot.
- If it is already in the imported decklist, that entry is converted to Commander.
- If it is absent, it is added automatically.
- Any commander marker from the source list is moved back to the main deck when a different commander is selected.

## Installation
Extract into the project root, replace matching files, clear `.next`, and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
