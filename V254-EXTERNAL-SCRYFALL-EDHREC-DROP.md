# Trading Docks v254 — External Scryfall and EDHREC drag-and-drop

- Resolves external Scryfall card pages, API URLs, and cards.scryfall.io images.
- Resolves EDHREC card URLs and dragged Scryfall imagery embedded by EDHREC.
- Reads URI list, plain text, HTML, and Firefox URL drag payloads.
- Preserves exact Scryfall printing when the external payload contains set/collector or UUID data.
- Falls back to fuzzy card-name resolution when only a readable name is available.
- Adds resolving and recoverable error states instead of silently ignoring unsupported drops.
- Internal Trading Docks drag-and-drop and deck trash behavior remain unchanged.
- No Supabase migration required.
