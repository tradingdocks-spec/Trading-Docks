# JustTCG Card Shows setup

The Card Shows Quick Lookup now searches live JustTCG pricing for:

- Pokémon
- Pokémon Japan
- One Piece
- Disney Lorcana
- Magic: The Gathering
- Singles and sealed products

## Vercel

Add `JUSTTCG_API_KEY` to Production and Preview, then redeploy. Keep the key server-side. Do not rename it with a `NEXT_PUBLIC_` prefix.

## Pricing labels

- Current: latest price supplied by JustTCG
- 30d low: lowest observed price for that exact variant in the past 30 days
- 30d average: average observed price for that exact variant in the past 30 days
- 30d high: highest observed price for that exact variant in the past 30 days

The selected current value is copied into the buying-percentage calculator. The seller can edit that price basis before calculating an offer.

## Adding another game

Add one entry to `src/lib/card-show-games.ts`. The selector and server-side allowlist both use this shared list.

## Free-tier protections

- Searches run only after pressing Search
- Up to 12 results are requested
- Responses are cached for 15 minutes
- No price history arrays are downloaded
- Remaining request allowance is shown when JustTCG returns it
