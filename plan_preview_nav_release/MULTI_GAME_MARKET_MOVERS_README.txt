TRADING DOCKS — MULTI-GAME MARKET MOVERS

LANDING PAGE
The former full market terminal has been replaced with a smaller Market
Movers section designed for first-time visitors.

The landing page now includes game tabs for:
- Magic: The Gathering
- Pokémon
- Disney Lorcana
- One Piece

The section displays only four cards at a time and includes:
- Market price
- Market low
- 24-hour movement
- 7-day movement
- Demand level
- Inventory owned
- Potential revenue
- Five-minute refresh
- Link to the full Market Center

FULL MARKET CENTER
/dashboard/market-intelligence

LIVE DATA SOURCES
- Magic: Scryfall
- Pokémon: Pokémon TCG API v2
- Lorcana: Lorcast
- One Piece: OPTCG API

The system uses same-origin image proxies for Pokémon, Lorcana, and One Piece
images. Magic images continue using the working exact-printing route.

DATA LIMITATION
The APIs do not all expose equivalent historical price data. Current card and
price information is live when supplied by the provider. The 24-hour and
7-day percentages are deterministic placeholders until Trading Docks begins
saving periodic price snapshots in Supabase or connects to a licensed market
history provider.

If an external game API is unavailable, that game's tab uses stable fallback
cards instead of breaking the landing page.

INSTALL
1. Extract this ZIP into the project root.
2. Replace matching files.
3. Stop the server.
4. Clear .next:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev

TEST
http://localhost:3000/api/multi-game-market
http://localhost:3000/dashboard/market-intelligence
