# Trading Docks Deck Vault — Token Polish V23

## Removed malformed token fragments

The classifier now rejects token names containing targeting or copied-object fragments, including:

- That's Copy Of Target
- A Copy Of Target
- Copy Of Target
- Target Token
- Target Creature
- Target Artifact
- Of Those
- Twice Of Those
- Or More
- Or Sacrifice

## Removed blank token cards

A token now appears in the Required Token Kit only when at least one of these is true:

1. Scryfall returned real token artwork.
2. The token name matches a recognized canonical MTG token type.
3. The object is an emblem.

This prevents malformed parser results from creating empty placeholder cards.

## UI safety filter

The Tokens workspace also performs a second display-level validation. Invalid names are removed before rendering, even if stale browser data temporarily contains an older false result.

## Canonical artwork fallback

A recognized real token without available artwork receives a compact named fallback rather than a large anonymous blank card.

## Installation

Extract into the Trading Docks project root and replace matching files.

Then clear the Next.js cache and restart:

```powershell
Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
npm run dev
```

Reopen the deck and allow Token Intelligence to run again.
