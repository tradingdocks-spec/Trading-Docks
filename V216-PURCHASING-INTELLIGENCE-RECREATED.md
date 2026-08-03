# Trading Docks v216 — Purchasing Intelligence

The previous Card Photo Scanner page has been rebuilt as a focused purchasing
workspace.

## Design changes

- Renamed to **Purchasing Intelligence**
- Large, focused scan stage before results appear
- Compact recognition summary
- Vertical exact-printing candidate selector
- Dominant purchase recommendation
- Buying rules collapsed by default
- Purpose-built market comparison table
- Dedicated source rows for Scryfall, TCGplayer, Mana Pool, CardSphere, and Cardmarket
- Marketplace connection states are visible and honest
- Action bar separated from market analysis
- Reduced visual clutter and repeated card imagery

## Data integrity

Mana Pool is represented as an official API connector slot, but live values are
not invented. Its row remains `API connection required` until credentials and
the exact endpoint contract are configured.

CardSphere is represented as a planned connector and does not display fabricated
prices.

Scryfall reference pricing and exact-printing marketplace links remain active.
