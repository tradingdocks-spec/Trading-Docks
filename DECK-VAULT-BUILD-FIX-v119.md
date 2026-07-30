# Deck Vault Build Fix v119

This release corrects the Deck Vault showcase TypeScript failures introduced in
v118.

## Corrections

- Uses one shared `DeckCardView` type for Text, Columns, Visual Grid, Stacks,
  Role, and Analytics.
- Passes the showcase studio's open/close state and deck identity into the card
  workspace.
- Preserves all v118 Deck Vault views and branded social-image features.

## Deployment

Deploy this package normally in Vercel. No Supabase migration or environment
variable changes are required.

## Verification

`npm run build` completed successfully with all 77 routes.
