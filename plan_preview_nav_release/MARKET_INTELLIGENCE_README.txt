TRADING DOCKS — MARKET INTELLIGENCE V2

IMPLEMENTED
- Automatic Scryfall market-price refresh every five minutes
- Current Market, TCG Low, TCG Market, 24-hour, 7-day, and 30-day movement
- Sales volume, listings, sold-today, EDHREC rank, Reserved List status
- User inventory count and potential revenue
- Hover lift, image enlargement, cyan glow, animated sparklines
- View Details hover action
- Automatic 18-second category rotation
- Pause/resume rotation
- Category tabs
- Biggest Movers, Buy Opportunities, and Inventory at Risk buckets
- Clickable market-detail drawer
- Price history
- TCGplayer listing link
- Card variants/printing identity
- Hold, Buy, and List suggested actions
- AI-style market insight and recommendation panel

IMPORTANT DATA NOTE
Scryfall supplies the live card identity and current USD price. Scryfall does
not expose TCGplayer listing count, sold-today count, eBay sold data, or true
historical price percentages. Those fields are currently deterministic demo
estimates so the completed user experience can be developed now.

For production, replace those estimates with:
- TCGplayer authorized data or a licensed market-data provider
- eBay Browse/Marketplace Insights data where permitted
- Your own historical snapshots stored in Supabase
- Your actual Trading Docks inventory records

The API route is:
  src/app/api/market-intelligence/route.ts

The active homepage section is:
  src/components/Landing/MarketSection.tsx

INSTALL
1. Extract into the project root and replace matching files.
2. Stop the server.
3. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
4. Restart:
   npm run dev
5. Test:
   http://localhost:3000/api/market-intelligence
