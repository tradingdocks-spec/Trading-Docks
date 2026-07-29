# Marketplace credential persistence v111

This release makes saved API credentials visible as a persistent, masked status
for every supported marketplace. Plaintext secrets are never returned to the
browser.

## Required Vercel server variables

Set all of these for Production, Preview, and Development, then redeploy:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY`
- `NEXT_PUBLIC_SITE_URL=https://www.tradingdocks.com`

Do not change `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY` after credentials have
been saved. If it must be rotated, re-enter and save every marketplace's
credentials once after the new deployment.

## eBay recovery

1. Confirm all five variables above exist in the deployed environment.
2. Redeploy after any environment-variable change.
3. Open Dashboard → Marketplaces → eBay.
4. If the panel says **Credentials saved**, leave the fields blank.
5. If the encryption key changed, enter all four eBay values and choose
   **Replace saved credentials**.
6. Choose **Authorize eBay read-only access**.

The authorization route now identifies a missing service-role key or encryption
key separately instead of returning the generic setup error.
