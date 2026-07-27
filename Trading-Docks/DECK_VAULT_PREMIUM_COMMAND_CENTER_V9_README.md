# Trading Docks Deck Vault — Premium Command Center V9

## What changed

### Desktop-readable typography
- Analytics headings increased to 18–20px.
- Core body and AI review text increased to 12–14px.
- Labels, helper text, metrics, and recommendation details were enlarged.
- The AI Deck Doctor is now treated as a primary workspace rather than a small dashboard widget.

### Rebuilt Color Demand
- Replaced the previous flat donut with an interactive segmented radial chart.
- Hovering a color enlarges its segment and updates the center readout.
- The main count now represents cards rather than mana symbols.
- Each color displays:
  - Card count
  - Percentage
  - Mana-pip count as supporting detail
  - Authentic MTG mana symbol
- Added a compact card-count summary beneath the visualization.

### Premium analytics hierarchy
The page now prioritizes:
1. Deck Intelligence overview
2. AI Deck Doctor
3. Mana curve and color demand
4. Deck composition and fundamentals
5. AI strategic review
6. Collection status
7. Current deck preview

### Visual system
- Added a technical grid and soft cyan/violet ambient lighting.
- Added a live Deck Intelligence hero.
- Added stronger metric hierarchy and larger numeric displays.
- Refined panels with premium borders, inset highlights, and improved spacing.
- Added a sticky AI review and collection rail on desktop.
- Replaced generic action styling with branded cyan, violet, emerald, and amber treatments.

## Installation

Extract this ZIP into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

## Included prior functionality

This package builds on V8 and retains:
- Working Change Commander picker
- Quick Add Basic Lands
- Exact basic-land search
- Authentic MTG mana symbols
- AI Deck Doctor API
- Format and color-identity validation
- Duplicate and legality warnings
- Compact card quantity treatment
