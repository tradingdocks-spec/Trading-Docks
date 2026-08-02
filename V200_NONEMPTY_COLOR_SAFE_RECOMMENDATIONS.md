# v200 — Non-empty, color-safe deck recommendations

- Enriches imported and legacy deck cards by exact name when a valid Scryfall UUID is unavailable.
- Generates strategy-focused upgrades even when a deck already meets every fixed structural target.
- Adds a broad EDHREC-ranked fallback candidate pass when narrow Oracle-text searches return too few results.
- Continues to reject cards already in the deck, digital-only cards, illegal cards, and every off-color identity.
- Ranks fallback cards against detected commander and deck themes before returning them.
- Requires no database migration.
