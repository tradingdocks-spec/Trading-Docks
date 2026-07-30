# eBay Read-Only Importer v115

## Install

1. Deploy this package to Vercel.
2. Run `supabase/migrations/202607290005_ebay_read_only_importer.sql` in Supabase.
3. Open Dashboard → Marketplaces → eBay → Open Import & Reconciliation.
4. Select **Import now**.

## Included

- Refreshes expired eBay OAuth access tokens automatically.
- Imports up to 200 Inventory API listings and 200 recent Fulfillment API orders per run.
- Prevents overlapping imports.
- Updates existing orders instead of duplicating them.
- Matches exact SKUs and stages metadata-based candidates as suggestions.
- Separates matched, suggested, unmatched, conflict, and ignored records.
- Records sync history and errors.
- Makes no writes to eBay.

## Important eBay limitation

The Inventory API returns inventory managed through eBay's Inventory API model.
Seller Hub or legacy listings may require an eBay Active Inventory Report in a
future phase. That report requires the full `sell.inventory` OAuth scope rather
than the current read-only Inventory scope.
