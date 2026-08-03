# Trading Docks v210 — Vercel TypeScript Fix

Fixed the Vercel build error in:

`src/components/dashboard/marketplaces/MarketplaceWorkspace.tsx`

The `EmailImportSetup` render call now passes the required:

`importAddressStatus={importAddressStatus}`

The permanent one-address-per-workspace behavior, explicit rotation protection,
and original address restoration SQL from v209 remain included.

Local build note:
This environment's internal npm registry returned a 404 for
`zod-validation-error@4.0.2`, so dependency installation could not be completed
here. The TypeScript mismatch reported by Vercel has been directly corrected.
