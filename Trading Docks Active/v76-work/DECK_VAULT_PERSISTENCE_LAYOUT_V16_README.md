# Trading Docks Deck Vault — Persistence & Layout V16

## Saved imported decks
- Imported decks now appear in Deck Vault after returning later in the same browser.
- Deck Vault loads IDs from `trading-docks-imported-decks` and hydrates each stored deck.
- Duplicate IDs are automatically merged.
- Search and format filters work across sample and imported decks.
- Changes made to imported decks auto-save after editing cards, commander, or format.

## Delete decks
- Deck cards now expose a delete button on hover.
- Deletion asks for confirmation.
- The deck record, unresolved-card data, and saved deck ID are removed from browser storage.
- The Deck Vault list updates immediately.

## Color Demand
- Rebuilt the color layout to prevent overflow.
- The radial chart scales down slightly.
- Color rows use responsive columns and minimum-width protection.
- Percentages stay inside their cards.
- Long supporting text wraps safely.
- The lower color summary adapts across desktop widths.

## Quick Add Basics
- Basic-land buttons now adapt to narrow sidebars.
- The layout switches between one and two columns depending on available width.
- Labels truncate safely rather than escaping the container.
- Official mana symbols remain intact.

## Installation
Extract into the project root, replace matching files, clear `.next`, and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

Imported decks are currently stored in browser localStorage. For cross-device accounts and production durability, the next architecture step should move deck persistence into Supabase.
