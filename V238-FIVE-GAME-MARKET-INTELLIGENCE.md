# Trading Docks v238 — Five-game Market Intelligence

## Games supported

- Magic: The Gathering
- Pokémon
- Pokémon Japan
- Disney Lorcana
- One Piece

## Public landing feed

`GET /api/multi-game-market`

The public landing feed no longer requires a Seller session. It returns cached,
read-only market data suitable for the homepage. Protected purchasing and
seller workflows remain plan-gated elsewhere.

## Market views

- Trending
- Movers
- Volume
- Opportunities

Each card includes:

- Current reference price
- Market-low reference
- 24-hour and seven-day Trading Docks signals
- Demand score
- Volume score
- Opportunity score
- Sparkline
- Source and data-quality badge

## Data adapters

- Magic: Scryfall
- Pokémon: Pokémon TCG API
- Pokémon Japan: configurable provider with built-in reference mode
- Lorcana: Lorcast
- One Piece: OPTCG API

## Optional environment variables

```text
POKEMON_TCG_API_KEY=
POKEMON_JAPAN_MARKET_ENDPOINT=
POKEMON_JAPAN_MARKET_API_KEY=
```

The Pokémon Japan endpoint may return an array, `{ cards: [] }`, or
`{ data: [] }`. Supported fields are:

```json
{
  "id": "string",
  "name": "string",
  "setName": "string",
  "setCode": "string",
  "collectorNumber": "string",
  "image": "https://...",
  "marketPrice": 0,
  "inventoryOwned": 0
}
```

Without a configured Japanese provider, Trading Docks clearly labels that tab
as a reference feed rather than presenting it as live pricing.
