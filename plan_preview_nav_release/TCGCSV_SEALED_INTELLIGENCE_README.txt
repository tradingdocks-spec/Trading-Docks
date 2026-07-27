TRADING DOCKS — TCGCSV SEALED PRODUCT INTELLIGENCE

WHAT IS NOW LIVE

The Sealed Product Buying workspace no longer relies on the small hardcoded
product list. It searches TCGCSV's cached TCGplayer catalog and joins Products
to Market Prices through productId.

NEW DATA

- TCGplayer product ID
- Product name and image
- TCGplayer product URL
- Category / game
- Group / set
- Product type
- Market Price
- Low Price
- Mid Price
- Direct Low Price
- Price subtype
- Presale status
- Product modified date

BUYING WORKFLOW

- Search by game and product name
- Add sealed products to an appraisal
- Adjust quantity
- Adjust package condition
- Enter current store inventory
- Enter shipping cost per unit
- Calculate marketplace fees
- Calculate net sale proceeds
- Calculate recommended cash offer
- Calculate store-credit alternative
- Calculate expected profit and margin
- Open the exact TCGplayer product page
- Purchase and send to intake

TCGCSV ROUTES

/api/tcgcsv/sealed/search?q=commander+masters&category=Magic
/api/tcgcsv/sync
/api/tcgcsv/image?url=...

MARKET DATABASE

A Supabase migration is included:

supabase/migrations/20260724_tcgcsv_market_database.sql

It creates:

- tcg_categories
- tcg_groups
- tcg_products
- tcg_current_prices
- tcg_price_history

The sync route can upsert the current catalog and append daily price-history
records. Configure:

NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
CRON_SECRET

DAILY SYNC

TCGCSV updates once per day. A Vercel cron example is included in:

vercel.json.example

The example schedule runs at 20:30 UTC, shortly after the normal TCGCSV update
window.

IMPORTANT DATA LIMITATIONS

TCGCSV provides cached TCGplayer product and price data. It does not provide
individual seller listings, true sales volume, exact days-to-sell, SKU-level
condition pricing, or eBay sold transactions. Trading Docks should calculate
velocity from its own price snapshots, inventory, orders, and purchase history.

INSTALL

1. Extract into the project root and replace matching files.
2. Run the Supabase migration if database syncing is desired.
3. Add SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET to .env.local.
4. Stop the server.
5. Clear .next:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
6. Restart:
   npm run dev

TEST

http://localhost:3000/api/tcgcsv/sealed/search?q=booster%20box&category=Pokemon

Then open:

http://localhost:3000/dashboard/sealed-buying
