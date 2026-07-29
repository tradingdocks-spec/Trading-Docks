# Trading Docks v114 — Admin integration save fix

This release makes platform marketplace credentials server-only and removes the
database migration's dependency on `public.is_platform_owner()`.

## Deploy

1. Deploy this release.
2. In Supabase SQL Editor, run:
   `supabase/migrations/202607290004_platform_marketplace_integrations_server_only.sql`
3. Confirm these Vercel variables are available to Production:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY` (at least 32 characters)
4. Redeploy after any environment-variable change.
5. Open Admin Control Center → Integrations and save the eBay credentials.

The form now reports the exact database or server-configuration error when a
save cannot be completed.
