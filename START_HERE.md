# Trading Docks v78

## Supabase

Open `RUN_THIS_FIRST_SUPABASE` and run:

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

The production build for this release was verified successfully before
packaging.
