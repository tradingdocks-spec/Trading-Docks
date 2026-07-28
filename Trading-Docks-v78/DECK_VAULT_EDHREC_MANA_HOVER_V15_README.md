# Trading Docks Deck Vault — EDHREC, Mana & Hover V15

## Grid hover
- Increased grid-card hover enlargement from 11% to 28%.
- Increased hover lift and stacking priority.
- The enlarged card now rises above nearby cards more clearly.

## Accurate mana symbols
- Quick Add Basics now uses the same official Scryfall mana-symbol SVG assets as the rest of Deck Vault.
- Every symbol is placed inside the same fixed-size circular container.
- All five colors render at the same visual scale.
- A readable color-letter fallback appears if an external symbol fails to load.

## EDHREC integration
- The Card Inspector action is now `Analyze on EDHREC`.
- It opens the selected card's EDHREC page in a new tab.
- This works whether the card was selected from Table View or Grid View.
- Card names are converted to EDHREC-compatible URL slugs.

Example:
`Arcane Signet` → `https://edhrec.com/cards/arcane-signet`

## Installation
Extract into the project root, replace matching files, clear `.next`, and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
