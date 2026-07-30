# Deck Vault Reliable Persistence v125

This release replaces the shared Deck Vault index document with one protected
database row per user deck.

## Required setup

Run this migration in the Supabase SQL Editor before testing deck imports:

`supabase/migrations/202607290006_deck_vault_reliable_persistence.sql`

Then deploy the application and sign in again.

## Verification

1. Upload or import a deck.
2. Wait until its deck page opens.
3. Return to Deck Vault and confirm it is listed.
4. Refresh the browser and confirm it remains listed.
5. Upload a second deck and repeat the refresh test.

The importer now verifies the saved row before navigating. Existing decks stored
by the earlier account-document system are migrated automatically when Deck
Vault is opened.
