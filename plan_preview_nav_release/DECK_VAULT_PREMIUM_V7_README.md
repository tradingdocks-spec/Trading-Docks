# Trading Docks Deck Vault — Premium Analytics V7

This overlay upgrades the Deck Vault card gallery and analytics workspace.

## Included

### Authentic MTG mana symbols
The custom approximations were removed. Mana displays now use Scryfall's card-symbol SVG assets for White, Blue, Black, Red, Green, and Colorless symbols.

### Compact premium card gallery
- Responsive auto-fill grid
- Approximately 118–128px minimum card width
- Reduced wasted horizontal space
- Centered card names
- Cyan/violet Trading Docks hover glow
- Amber Game Changer treatment
- Red legality and duplicate warnings
- Standalone commander remains excluded from the main deck

### Color-demand analytics
- Color-coded donut chart
- Authentic mana symbols
- Colored-pip totals
- Percentage breakdown
- Detailed demand bars remain available below the chart

### AI Deck Doctor
The new analytics panel:
- Enriches the current deck through Scryfall card data
- Checks format legality
- Checks Commander/Brawl color identity
- Measures card draw, ramp, interaction, wipes, protection, finishers, combo support, lands, and average mana value
- Searches Scryfall for legal candidates
- Excludes cards already in the deck
- Ranks recommendations
- Suggests possible cuts
- Displays confidence, price, issue solved, and card artwork

The engine is useful without an AI key. In that mode it uses deterministic deck-structure rules plus Scryfall data.

When `OPENAI_API_KEY` is configured, the server sends only the analyzed deck profile and the already-validated candidate pool to the model. The model is instructed to rank only supplied legal candidates and not invent cards, prices, rules text, or combos.

## Environment variables

Add these to `.env.local` to enable AI refinement:

```env
OPENAI_API_KEY=your_key_here
OPENAI_DECK_DOCTOR_MODEL=gpt-5-mini
```

`OPENAI_DECK_DOCTOR_MODEL` is optional.

## Installation

1. Extract this ZIP into the Trading Docks project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
```

5. Restart:

```powershell
npm run dev
```

## New API route

```text
POST /api/deck-vault/deck-doctor
```

Request body:

```json
{
  "cards": [],
  "format": "Commander",
  "commanderName": "Atraxa, Praetors' Voice"
}
```

## Accuracy design

No recommendation engine can guarantee perfect gameplay advice. V7 improves reliability by separating the workflow into layers:

1. Current card data is resolved through Scryfall.
2. Structural needs are measured from the actual list.
3. Candidate cards are filtered by format legality.
4. Commander candidates are filtered by color identity.
5. Existing deck cards are excluded.
6. AI may rank and explain only the validated candidate set.
7. The deterministic Scryfall-backed engine remains available if AI is unavailable.
