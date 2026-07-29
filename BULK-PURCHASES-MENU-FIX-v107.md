# Bulk Purchases Menu Fix — v107

The Purchasing menu's former **Bulk Buying** placeholder now opens the complete
Bulk Purchases workspace.

## What changed

- Renamed **Bulk Buying** to **Bulk Purchases** in desktop and mobile navigation.
- Connected `/dashboard/bulk-buying` to the same purchase records and workflow as
  `/dashboard/inventory/bulk-purchases`.
- Preserved the purchase name, date, estimated card count, amount paid,
  additional expenses, CSV association, scanned value, projected profit,
  sales-recovery, and cost-basis features introduced in v106.
- Preserved the canonical-domain and persistent-session fixes from v104–v106.

## Database setup

If the v106 migration has not already been run, execute:

`supabase/migrations/202607290001_bulk_purchase_profitability.sql`

in the Supabase SQL Editor before using Bulk Purchases.
