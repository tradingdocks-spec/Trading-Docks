TRADING DOCKS — POKÉMON IMAGE FIX

ROOT CAUSE

The values visible in the screenshot matched the hardcoded Pokémon fallback
records exactly. That means the Pokémon TCG API adapter failed and the entire
game switched to fallback cards. Those fallback cards had empty image fields,
so the UI displayed initials instead of artwork.

FIXES

- Replaced name searches with stable Pokémon card IDs.
- Each Pokémon card request now fails independently.
- One failed card no longer removes images from all four cards.
- Added official images.pokemontcg.io CDN URLs to every fallback card.
- Preserved images even when live price retrieval fails.
- Added optional POKEMON_TCG_API_KEY support.
- Added browser image-error handling so broken image icons are not displayed.

CURRENT CARD IDS

sv3-125     Charizard ex
swsh7-215   Umbreon VMAX
sv4pt5-063  Pikachu
swsh8-271   Gengar VMAX

OPTIONAL API KEY

Copy .env.local.example to .env.local and enter a Pokémon TCG API key:

POKEMON_TCG_API_KEY=your_key_here

The official API permits requests without authentication, but unauthenticated
requests have substantially lower rate limits.

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Optionally configure POKEMON_TCG_API_KEY.
4. Stop the development server.
5. Clear .next.
6. Restart npm run dev.

TEST

http://localhost:3000/api/multi-game-market?game=pokemon

Each card's image should begin with:

/api/tcg-image?url=https%3A%2F%2Fimages.pokemontcg.io
