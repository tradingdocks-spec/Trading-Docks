# Trading Docks Deck Vault — Compact Token Kit V21

## Token quantity simplification

Token Intelligence no longer recommends quantities such as `12–20`.

Each result now represents one unique token type the deck can create.

The interface instructs users to:

- Bring one physical token card for each unique type
- Use dice or counters when multiple copies are created

## Compact token cards

The token cards were reduced substantially in size.

The new layout:

- Displays up to four token cards per row on large desktop displays
- Uses a shorter artwork crop
- Reduces card padding and vertical height
- Keeps the full list of cards that create each token
- Adds a unique-token total to the header
- Uses a compact `1 type` badge
- Preserves token artwork and hover polish

## Installation

Extract into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
