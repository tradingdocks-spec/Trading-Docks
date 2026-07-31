# Buylist automation setup

## 1. Database

Run these migrations in order in Supabase:

1. `supabase/migrations/202607310001_buylist_intelligence.sql`
2. `supabase/migrations/202607310002_buylist_automatic_feeds.sql`

## 2. Vercel environment

The existing server configuration must include:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CRON_SECRET`

Never expose the service-role key or cron secret through a `NEXT_PUBLIC_` variable.

## 3. Enable and test

Open **Purchasing → Buylist Connections**, enable **Automatic daily sync**, and select **Sync now**. The first sync only imports Card Kingdom prices for exact printings already present in that user's inventory.

Vercel calls `/api/buylist/mtgjson` daily at 16:15 UTC. The job processes up to 25 due connections per run. Additional provider adapters can use the same connection and offer metadata model.

## Data meaning

MTGJSON Card Kingdom prices are marked **Indicative** because they do not confirm live wanted quantity, accepted condition, or the final grade. Users must verify the offer on the store submission page. Direct store CSV/API feeds remain marked **Authorized**.
