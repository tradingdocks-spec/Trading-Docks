# Trading Docks v79

## Supabase

If you already applied the v78 Account Data Foundation migration, there is no
new SQL to run for v79.

For a fresh installation, open `00_RUN_THIS_FIRST_SUPABASE` and run:

1. `ACCOUNT_DATA_FOUNDATION.sql`
2. `VERIFY_ACCOUNT_DATA_ISOLATION.sql`

The inventory migration from v77 must already be installed. If it is not,
run `supabase/migrations/202607280004_inventory_persistence.sql` before the
Account Data Foundation migration.

## Application deployment

After the SQL migration succeeds:

1. Replace the existing project files with this release.
2. Keep your existing `.env.local` values.
3. Run `npm install`.
4. Run `npm run build`.
5. Deploy to Vercel.

The production build for this release passed all 69 application routes before
packaging.

## v79 dashboard changes

- Cleaner, full-width personal dashboard layout
- Compact collection-growth empty state with an inventory call to action
- Dashboard plan is resolved from the effective billing or override plan
- Free modules: inventory value, inventory count, and collection growth
- Seller modules: revenue, orders, marketplace health, listing queue, automation
- Store modules: calendar, employee activity, AI recommendations, supply alerts
- Locked modules cannot be selected, resized, removed, or submitted
- Server-side layout validation removes unauthorized widgets before saving
