# Trading Docks v40

This package makes the Trials & Promotions expansion visibly identifiable.

## Confirm the correct version

After starting the website and opening Admin Control Center, verify all three:

- `v40 · Trials enabled` appears beside **Owner workspace**.
- **Trials & Promotions** appears in the Administration menu.
- **Manage free trials** appears on the Overview page.

If those items are missing, an older project folder or development server is still running.

## Database setup

Apply these migrations in order if they have not already been applied:

1. `supabase/migrations/202607260002_admin_control_center.sql`
2. `supabase/migrations/202607260003_trials_and_promotions.sql`

The migration enables trial data. It does not control whether the navigation item is visible.
