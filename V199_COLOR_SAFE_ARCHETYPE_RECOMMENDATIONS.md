# v199 — Color-safe, archetype-aware recommendations

- Resolves Commander color identity directly from Scryfall by exact name when the command-zone card is not tagged correctly.
- Sends the deck's saved card colors to the recommendation API as a fallback.
- Applies color-identity filtering to every format, not only Commander.
- Revalidates legality and color identity after AI ranking and immediately before the response.
- Detects prominent themes and typal strategies to guide recommendation relevance.
- Colorless cards remain eligible; cards containing any color outside the deck identity are rejected.
- No database migration is required.
