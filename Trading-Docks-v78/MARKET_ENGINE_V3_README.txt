TRADING DOCKS — CENTRAL MARKET ENGINE V3

WHAT CHANGED

The multi-game market system is now centralized under:

src/lib/market-engine/

ADAPTERS
- Magic: Scryfall
- Pokémon: Pokémon TCG API
- Lorcana: Lorcast
- One Piece: OPTCG API

The landing page, dashboard Market Center, Collection Buying Center, inventory
tools, and future AI assistant can now reuse the same normalized API payload:

/api/multi-game-market
/api/multi-game-market?game=pokemon

POKÉMON FIX

The Pikachu entry no longer relies on a single hardcoded ID.

The adapter now:
1. Tries several preferred Pikachu ex IDs.
2. Verifies the returned record contains an image.
3. Falls back to a name search.
4. Sorts matching printings by market price.
5. Uses the official images.pokemontcg.io CDN.
6. Falls back to a known Surging Sparks image if the API is unavailable.

This prevents one missing or retired card ID from breaking the image.

FILES ADDED

src/lib/market-engine/index.ts
src/lib/market-engine/types.ts
src/lib/market-engine/helpers.ts
src/lib/market-engine/fallbacks.ts
src/lib/market-engine/adapters/magic.ts
src/lib/market-engine/adapters/pokemon.ts
src/lib/market-engine/adapters/lorcana.ts
src/lib/market-engine/adapters/one-piece.ts

OPTIONAL POKÉMON API KEY

Copy .env.local.example to .env.local:

POKEMON_TCG_API_KEY=your_key_here

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev

TEST

http://localhost:3000/api/multi-game-market?game=pokemon

The Pikachu entry should now contain a populated image URL beginning with:

/api/tcg-image?url=https%3A%2F%2Fimages.pokemontcg.io

The UI also includes an onError fallback, so a broken-image browser icon will
not be shown even if a provider temporarily fails.
