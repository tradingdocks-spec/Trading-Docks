# Trading Docks v144 — Stability and Speed

## Verified and improved

- Deck Vault reads and writes `deck_vault_decks` by authenticated account.
- A browser-local, account-scoped recovery copy is written before each remote save.
- Pending recovery data is preferred only when a remote save did not finish.
- Successful saves mark the recovery copy synchronized, allowing newer cross-device data to win.
- Failed loads can recover the most recent local deck instead of presenting an empty vault.
- Deck deletion also removes its recovery copy.
- Deck detail displays `Saving`, `Saved`, and failure states.
- Failed saves now include a `Retry save` action.
- Closing or refreshing while a save is pending/failed triggers an unsaved-change warning.
- The Supabase browser client is reused instead of recreated for each operation.
- Deck persistence uses the current browser session and relies on database row-level security,
  eliminating an extra remote identity check on every save/load.
- Automatic deck intelligence waits 2.5 seconds after meaningful card/format changes.

## Verified existing behavior

- Import saves the deck before navigating to its detail page.
- Returning to Deck Vault reloads account-backed decks.
- Rename and delete actions use the account database.
- Autosave is serialized so overlapping writes cannot reorder deck versions.
- Showcase images already use lazy loading in the largest poster/grid renderers.

## Recommended next refactor

The deck detail workspace remains a 6,000+ line client component. Splitting its views,
analytics, showcase/export tools, and inspectors into separately loaded components is
still the highest-impact architectural performance project. Server-side account and plan
lookups should also be consolidated into one request-scoped account context.

No Supabase migration is required for v144.
