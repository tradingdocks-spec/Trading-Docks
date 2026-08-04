# Trading Docks Command Center Setup

## 1. Create your normal account
Sign in to Trading Docks using the email that should own the platform. The user must already exist in Supabase Auth.

## 2. Install the database migration
Open Supabase Dashboard → SQL Editor and run:

`supabase/migrations/20260804_admin_command_center.sql`

Review the migration first if your project already has tables or types with the same names.

## 3. Promote your account to Owner
In the Supabase SQL Editor, replace the example email and run:

```sql
select public.promote_owner('YOUR-EMAIL@example.com');
```

Then sign out and sign back in, or open Profile and refresh the app. A **Command Center** item will appear in Profile.

## Security notes
- Never add the Supabase service-role key to `.env` in the Expo project.
- Administrative data is protected by RLS and security-definer functions.
- Store subscriptions and admin roles are intentionally separate.
- Enable MFA for Owner and Admin accounts before production.
- Connect RevenueCat webhooks before treating subscription status as authoritative.
