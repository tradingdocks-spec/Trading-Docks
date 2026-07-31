# Card Preview and Color Identity — v155

- Card previews now follow the pointer and remain close to it while respecting viewport edges.
- Replacement suggestions use the commander identity for Commander decks and the deck's color combination for other formats.
- Colorless cards and artifacts are allowed.
- Cards whose color identity contains any color outside the deck's allowed colors are rejected after search as a strict safety check.
- Existing format-legality and functional-similarity ranking remain in place.
- No Supabase migration is required.
