# Trading Docks Deck Vault — Fixed Hover & Commander V12

## Hover preview fix

The table hover preview no longer uses an absolutely positioned panel inside the scrollable table.

It now:

- Uses fixed viewport positioning
- Measures the hovered card name
- Automatically chooses the left or right side
- Clamps the preview inside the browser window
- Prevents the card artwork from being cut off at the top
- Prevents clipping by the table's internal scrollbar
- Continues to support keyboard focus

## Commander placement

The Cards workspace now always shows the full commander card in the upper-left Deck Explorer area.

The commander panel includes:

- Full card image
- Commander name
- Color identity symbols
- Change Commander button

The commander remains standalone and is not counted in the main deck.

## Installation

Extract into the Trading Docks project root, replace matching files, clear `.next`, and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
