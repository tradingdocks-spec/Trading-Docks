# Trading Docks Deck Vault — Import Center V13

V13 replaces the unfinished import mockup with a working import workflow.

## Working import methods

- Paste a decklist
- Load a public Moxfield deck URL
- Upload TXT, CSV, or DEK files
- Drag and drop supported files

## Recognized decklist structure

- Commander
- Main deck / mainboard
- Sideboard
- Maybeboard / considering
- Plain `1 Card Name` lists
- `1x Card Name (SET) 123` exports
- CSV rows with quantity, name, set, and collector number
- Foil markers and common export suffixes

## Card resolution

After parsing, cards are resolved through Scryfall in batches. The importer retains:

- Quantity
- Commander and board assignment
- Set code and collector number when available
- Card artwork
- Art crop
- Mana value
- Color identity
- Type line
- Market price
- Game Changer status
- Functional role classification

## Imported deck workflow

The Import button now:

1. Resolves the recognized cards.
2. Builds a real DeckRecord.
3. Saves the imported deck in browser storage.
4. Opens it directly in the Deck Vault editor and analytics workspace.
5. Preserves unresolved-card information for later review.

## Moxfield note

Moxfield does not publish a guaranteed public API. This build uses the endpoints currently used by public integrations and returns a clear error if Moxfield blocks or changes them. Paste/export and file import remain available independently.

## Installation

Extract into the Trading Docks project root, replace matching files, clear `.next`, and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```
