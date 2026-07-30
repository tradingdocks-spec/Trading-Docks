# Deck Vault Live Integration and Persistence — v120

This release fixes the split between the live Deck Vault and the unused
`dashboard-v2` implementation.

## Fixed

- Decks now save to and load from the signed-in Trading Docks account.
- Imported decks remain available after refresh, sign-out/sign-in, and use on
  another device.
- Deck edits, renames, and deletes use the same account-backed persistence.
- The live deck Cards tab now includes Text, Columns, Visual Grid, Stacks,
  Role, and Analytics views.
- The live deck page now includes the Trading Docks "Show Off Your Deck"
  showcase studio and social-image export.
- Deck limits and upgrade links remain tied to the user's effective plan.

## Deployment

Deploy this release normally. If the account data foundation migration was not
previously applied, run:

`supabase/migrations/202607280005_account_data_foundation.sql`

No new environment variables are required.

## Verification

The Next.js production build completed successfully across all 77 routes.
