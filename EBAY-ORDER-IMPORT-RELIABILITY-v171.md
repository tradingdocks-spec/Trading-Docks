# eBay order import reliability — v171

## Fixed

- Automatically releases abandoned eBay sync runs after an interrupted serverless request.
- Fetches eBay listing offers concurrently instead of one at a time.
- Writes listing mappings, orders, and order items in database batches.
- Imports every available page of eBay inventory and completed-checkout orders.
- Adds a per-request timeout so upstream eBay failures are reported and the run is closed cleanly.
- Preserves duplicate-safe upserts for repeat imports.

## Deployment

No additional Supabase migration is required for this release. Deploy the source and use **Import now**. An abandoned run older than five minutes will be marked failed automatically before the new import begins.

The eBay Fulfillment API returns completed-checkout orders from its available order window. If eBay returns an authorization/scope error, reconnect the seller account once so the existing read-only fulfillment scope is granted.
