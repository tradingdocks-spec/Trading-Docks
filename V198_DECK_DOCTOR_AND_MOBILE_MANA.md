# Trading Docks v198

## Deck Doctor recommendations

- Filters candidates through Scryfall format legality before ranking.
- Enforces Commander color identity, including colorless decks.
- Uses deck-role gaps, commander/theme synergy, curve fit, existing cards, and EDHREC popularity to rank related cards.
- AI may rank only the supplied verified candidates; it cannot invent cards, legality, prices, or combos.
- Recommendation cards explain the issue solved, reasoning, confidence, price when available, and a possible replacement.

## Mobile mana symbols

- Mana symbols are packaged with the application instead of being loaded from a blocked third-party asset host.
- White, blue, black, red, green, and colorless symbols render across Deck Vault details, breakdowns, summaries, editor surfaces, and deck cards.
- The existing text fallback remains available if an individual image cannot render.

No new Supabase SQL is required.
