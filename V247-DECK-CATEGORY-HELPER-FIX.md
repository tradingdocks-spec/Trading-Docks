# Trading Docks v247 — Deck Category Helper Fix

Fixed the Vercel TypeScript error:

`Cannot find name 'inferCategoryFromDeckCard'`

The helper now restores a normal deck category when a card leaves the Commander
section. It derives the category from the card type line:

- Lands
- Creatures
- Artifacts
- Enchantments
- Planeswalkers
- Instants
- Sorceries
- Other

All v245 and v246 Deck Builder features remain included.
