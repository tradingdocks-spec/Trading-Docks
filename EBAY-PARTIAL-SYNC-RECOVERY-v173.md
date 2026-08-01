# eBay partial-sync recovery — v173

- Retries eBay's transient system error `25001` before giving up.
- Treats listing inventory and order retrieval as independent import sources.
- Continues importing orders when eBay's `inventory_item` endpoint is temporarily unavailable.
- Preserves previously imported listings and images instead of replacing them with empty records.
- Records upstream problems as sync warnings and marks the connection for attention.
- Fails the run only when both inventory and orders are unavailable.
- No Supabase migration is required.
