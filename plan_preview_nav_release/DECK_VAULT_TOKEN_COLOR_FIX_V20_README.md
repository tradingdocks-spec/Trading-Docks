# Trading Docks Deck Vault — Token & Commander Color Fix V20

## Commander color identity fix

The colorless diamond was appearing because the hero used every color found anywhere in the deck. Colorless artifacts and lands therefore added `C` to colored commanders.

V20 now:

- Uses the selected commander's color identity in the commander hero.
- Removes `C` whenever the commander has one or more colored identity symbols.
- Retains `C` for genuinely colorless commanders.
- Stores command-zone colors when importing a deck.
- Stores the combined identity for legal two-commander decks.
- Repairs the same display behavior on Deck Vault deck cards.
- Uses command-zone colors when auto-saving imported decks.

Example:

- Chatterfang now displays Black and Green.
- A colorless commander still displays the colorless diamond.
- A Partner pair displays the combined colored identity of both commanders.

## Token generator root-cause fix

Imported card IDs were stored in this form:

```text
<scryfall-uuid>-main
<scryfall-uuid>-commander
```

The intelligence API previously submitted those full values to Scryfall as card IDs. They are not valid Scryfall UUIDs, so the card collection request could not resolve imported cards. Without resolved oracle text or related token parts, Token Intelligence returned an empty result.

V20 now resolves imported cards using this order:

1. Exact set code and collector number
2. Extracted Scryfall UUID
3. Exact card name

It then retrieves:

- Oracle text
- Related token parts
- Legalities
- Color identity
- Card faces
- Token relationships

This allows Token Intelligence 2.0 to analyze imported Moxfield, ManaBox, text, CSV, and file-based decks correctly.

## Existing token detection retained

The corrected resolver feeds the expanded V19 token parser, including:

- Squirrel tokens from Chatterfang replacement wording
- Spider tokens
- Treasure, Food, Clue, Blood, Gold, Map, and Powerstone
- Named tokens and token copies
- Emblems
- Related Scryfall token objects
- Common creature-token types
- Recommended token quantities
- Token artwork

## Installation

Extract the ZIP into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

Open the deck again and allow the Intelligence request to finish. Token cards should then populate in the Tokens tab.
