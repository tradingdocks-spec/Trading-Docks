# Trading Docks v113 — Admin Marketplace Integrations

## Deploy

1. Deploy this release.
2. In Supabase SQL Editor, run:
   `supabase/migrations/202607290003_platform_marketplace_integrations.sql`
3. Keep these server variables configured in Vercel:
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY`
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - `NEXT_PUBLIC_SITE_URL=https://www.tradingdocks.com`
4. Redeploy after confirming environment variables.
5. Sign in with the platform-owner account and verify the Admin Control Center authenticator.
6. Open **Admin Control Center → Integrations**.
7. Enter the shared eBay Production Client ID, Client Secret, and RuName once.
8. Select **Encrypt and activate eBay**.

## Store experience

Store accounts never see marketplace developer credentials. A store opens
**Marketplaces → eBay**, selects **Connect eBay account**, signs in on eBay, and
approves access. OAuth tokens and marketplace records remain separate for every
Trading Docks account.

## Security

The platform integration endpoint independently verifies the permanent owner
email. Supabase Row Level Security also restricts the platform credential table
to `public.is_platform_owner()`. Secrets are encrypted with AES-256-GCM and are
never returned to the browser after saving.

`SUPABASE_SERVICE_ROLE_KEY` and `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY` remain
in Vercel and are not displayed or editable in the Admin Control Center.
