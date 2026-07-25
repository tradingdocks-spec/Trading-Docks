# Trading Docks Deck Vault — Intelligence System V18

V18 combines format validation, advanced command zones, token intelligence, and inventory ownership intelligence into one deck workflow.

## Format-aware importing

The import page now supports:

- Commander
- Standard
- Modern
- Pioneer
- Legacy
- Vintage
- Pauper
- Brawl
- Oathbreaker
- Duel Commander
- Canadian Highlander

The selected format is saved with the deck and used by the live validation engine.

## Live format validation

A new server route enriches cards through Scryfall and validates:

- Banned cards
- Cards that are not legal in the selected format
- Restricted cards
- Singleton copy limits
- Four-copy limits
- Basic-land exemptions
- Deck size warnings
- Missing commanders
- Too many commanders
- Partner legality

In Grid View, illegal cards receive a bright red hover overlay that explains the problem.

In Table View, banned and illegal cards receive clear red status badges.

## Advanced Command Zone

Import now supports:

- One commander
- Two Partner commanders
- Friends Forever
- Choose a Background
- Doctor's Companion
- Other two-card command-zone combinations validated by the intelligence route

The imported deck stores both `commander` for backward compatibility and `commanders` as an array.

## Token Intelligence

The Tokens tab:

- Reads Scryfall related-card data
- Inspects oracle text for token creation
- Finds token images
- Identifies the cards that create each token
- Recommends practical quantities to bring

## Inventory Intelligence

The Ownership tab matches the deck against Trading Docks inventory data and displays:

- Required quantity
- Owned quantity
- Physical location
- Condition
- Printing
- Marketplace platform
- Listing ID support
- Reserved-for-deck status

The browser implementation reads normalized inventory records from:

```text
localStorage["trading-docks-inventory"]
```

Expected record shape:

```json
{
  "inventoryId": "inv-123",
  "name": "Sol Ring",
  "quantity": 2,
  "location": "Binder A / Row 4",
  "condition": "Near Mint",
  "printing": "Commander Masters",
  "platform": "TCGplayer",
  "listingId": "listing-123",
  "reservedForDeck": false
}
```

A Supabase migration is included for production persistence:

```text
supabase/migrations/20260724_deck_vault_intelligence.sql
```

## New workspaces

- Intelligence
- Tokens
- Ownership

These update from the same live deck analysis.

## New API

```text
POST /api/deck-vault/intelligence
```

It accepts:

```json
{
  "cards": [],
  "format": "Commander",
  "inventory": []
}
```

## Installation

Extract into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

## Production note

The included implementation is fully wired for local Deck Vault records and normalized inventory data. To make ownership and reservations cross-device and multi-user, run the included Supabase migration and connect the existing Trading Docks inventory tables to the intelligence request.
