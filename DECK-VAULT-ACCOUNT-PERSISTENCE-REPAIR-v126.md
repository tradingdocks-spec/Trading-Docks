# Deck Vault Account Persistence Repair v126

This release repairs Deck Vault persistence on databases that already contain
the original `deck_vault_decks` table.

## Required setup

Run this migration in the Supabase SQL Editor:

`supabase/migrations/202607290007_deck_vault_account_persistence.sql`

Then deploy the application and sign in again.

## What changed

- Existing Deck Vault schemas are upgraded in place.
- Each deck is stored as an independent row owned by the signed-in user.
- Imports use collision-safe UUIDs.
- Saving is verified before the imported deck opens.
- Loading ignores legacy metadata-only rows.
- Deck deletion is removed from the interface.
- Authenticated users no longer have database permission to delete deck rows.

## Verification

1. Sign in and import two different decks.
2. Return to Deck Vault and confirm both appear.
3. Refresh the page.
4. Sign out and back in.
5. Confirm both decks remain available.
