# Trading Docks v226 — Mana Pool Integration v1

## Implemented documented endpoints

- `GET /account`
- `GET /buyer/orders`
- `GET /buyer/orders/{id}`

## Sync behavior

- Validates the saved Mana Pool key against `/account`
- Automatically detects Bearer, X-API-Key, or raw Authorization token format
- Uses `since`, `limit`, and `offset` pagination
- Fetches up to 2,000 orders per sync
- Fetches individual order details
- Upserts duplicate-safe orders into `marketplace_orders`
- Upserts order lines into `marketplace_order_items`
- Updates connection health and last-sync metadata
- Marks failed connectors as `attention`
- Displays imported Mana Pool orders in Universal Orders

## Important source limitation

The supplied documentation screenshots show the `buyer/orders` resource. This
release imports that documented resource exactly as provided. The screenshots
do not establish a separate seller-sales endpoint. If Mana Pool exposes a
seller-specific sales route elsewhere in the documentation, that route should
replace or supplement `/buyer/orders` before treating every returned record as
a seller sale.

## Environment variables

Only these optional Mana Pool variables remain:

- `MANAPOOL_API_BASE_URL=https://manapool.com/api/v1`
- `MANAPOOL_INITIAL_SYNC_SINCE=`

Customers only provide their own Mana Pool API key.
