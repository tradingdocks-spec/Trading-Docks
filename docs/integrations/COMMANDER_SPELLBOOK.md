# Commander Spellbook Integration

Status: Implemented as an additive server-side combo provider.

Commander Spellbook is used only through a provider boundary in `src/lib/deck-architect/combo-provider.ts`. React components do not call Commander Spellbook directly.

## Purpose

- Detect complete combos already in a deck.
- Detect fully owned combo opportunities.
- Detect near-combos and missing pieces.
- Add combo relevance as one recommendation signal.

Combo data is additive. Deck Architect and Deck Vault continue to work if Commander Spellbook is unavailable.

## API Usage

The provider uses the public Commander Spellbook backend `find-my-combos` endpoint from the open Commander Spellbook backend architecture. Responses are normalized into Trading Docks domain types before they reach product routes.

Normalized fields include:

- combo id
- cards and commander requirements
- prerequisites
- steps
- results
- Commander legality
- popularity when present
- win-condition classification
- source URL

## Caching And Failure Handling

- Server-side TTL cache avoids repeated fetches for the same deck payload.
- Requests use a timeout.
- HTTP errors, malformed payloads, rate limits, and outages return an unavailable combo report instead of failing deck generation.
- Logs include safe provider stage, latency, and aggregate counts only.

## Attribution

Combo source: Commander Spellbook.

Trading Docks stores normalized provider observations only for runtime analysis unless a future reviewed cache migration is approved.
