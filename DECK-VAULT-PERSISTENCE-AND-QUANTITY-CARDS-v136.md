# Deck Vault persistence and quantity cards — v136

## Fixed

- Deck Vault now loads the same account-owned Supabase records written by deck
  import and deck editing. Returning to Deck Vault no longer depends on
  browser-local deck keys.
- Deck renames and deletes use the shared account persistence layer.
- Save and load failures are shown instead of silently replacing the vault with
  an empty list.
- A dedicated account-scoped RLS migration keeps Deck Vault reads, inserts,
  updates, and deletes limited to the signed-in user.

## Showcase improvements

- The longer text-list lane is always positioned on the left so the two-column
  list reads as a squared, balanced block.
- Visual posters show one image for each unique card rather than repeating every
  physical copy.
- Quantities are displayed as a clean badge, such as `×4`, on both the preview
  and exported HD PNG.
- Category sizing now uses unique-card count, preventing basic lands and
  four-of cards from covering the rest of a section.

## Required database update

Run `00_DECK_VAULT_PERSISTENCE_REPAIR_RUN_IN_SUPABASE.sql` once in the Supabase
SQL editor before testing delete behavior. Existing saves and loads remain
account-scoped through the previously installed durable-account migration.
