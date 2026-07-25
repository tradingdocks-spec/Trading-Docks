# Trading Docks Deck Vault — Hover Preview V11

## New Card Hover Preview

The table view now supports instant card previews.

Hover or keyboard-focus the card name to display:

- Large card artwork
- Card name
- Full type line
- Mana value
- Quantity
- Current price

The preview floats beside the row and does not require opening the inspector.

## Interaction

- Hovering the card name opens the preview.
- Moving away closes it.
- Keyboard focus also opens it for accessibility.
- Clicking the card name still selects the card in the persistent Card Inspector.
- Role View cards now include the same hover-preview behavior.

## Styling

- Premium cyan Trading Docks border and glow
- High-contrast dark floating surface
- Large readable typography
- No interruption to table scrolling or bulk selection

## Installation

Extract into the Trading Docks project root, replace matching files, clear `.next`, and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
