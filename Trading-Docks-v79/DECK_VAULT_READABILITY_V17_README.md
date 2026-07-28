# Trading Docks Deck Vault — Readability V17

## Color Demand
- Removed mana-pip totals from every color row and summary card.
- Color Demand now focuses only on cards containing each color.
- Rebuilt each color row as a three-column layout: symbol, card count, percentage.
- Percentages use their own compact badge and cannot overflow the panel.
- Card counts and color names stay inside their containers.
- The radial chart remains interactive and updates its center value on hover.

## Deck Vault home readability
- Increased typography throughout the Deck Vault landing page.
- Enlarged KPI labels and supporting details.
- Enlarged deck names, commander names, themes, dates, and metric labels.
- Enlarged AI Deck Review text.
- Enlarged Collector Loop text and number markers.
- Improved secondary-text contrast.

## Card Inspector buttons
The following actions now use the same:
- Height
- Font size
- Font weight
- Horizontal padding
- Center alignment
- Line height
- Hover behavior

Actions:
- Analyze on EDHREC
- Find Replacement
- Remove from Deck

## Installation
Extract into the Trading Docks project root, replace matching files, clear `.next`, and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
