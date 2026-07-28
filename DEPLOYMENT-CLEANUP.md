# Trading Docks clean deployment

This package contains one application source tree. Historical release folders,
compiled `.next` output, `node_modules`, empty placeholder files, `.git`, and
local secret files were intentionally excluded.

## Deploy

1. Replace the repository contents with this package while preserving your
   repository's `.git` folder.
2. In Vercel, confirm the Production environment contains:
   - `RESEND_API_KEY`: the complete Resend key beginning with `re_`
   - `RESEND_FROM_EMAIL`: `Trading Docks <invites@tradingdocks.com>`
   - `NEXT_PUBLIC_SITE_URL`: `https://www.tradingdocks.com`
3. Redeploy Production without reusing the build cache.
4. In Admin → Trials & Promotions, use **Resend invitation** on the existing
   active trial. Do not grant the same person a second trial.

The invitation route now trims accidental spaces and surrounding quotes,
accepts `EMAIL_FROM` as a temporary fallback, recognizes incomplete keys, and
reuses an existing open trial instead of creating a duplicate.

## Validation

- ESLint: no errors
- TypeScript: passed
- Next.js production build: passed
- Generated pages/routes: 71
