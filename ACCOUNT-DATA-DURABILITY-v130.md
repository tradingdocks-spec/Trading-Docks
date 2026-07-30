# Trading Docks account-data durability

1. In Supabase SQL Editor, run the full contents of:
   `supabase/migrations/202607300001_durable_account_data.sql`
2. Confirm Supabase reports success.
3. Deploy this release.
4. Sign out and back in.
5. Import two decks, edit a card in each, wait for the green account-saved status,
   refresh, and confirm both decks and their edits remain.
6. Add an inventory item, wait for the save confirmation, refresh, and confirm it
   remains.

Decks, deck cards, inventory items, locations, movements, calendar data, buying
records, and other account documents are isolated by the signed-in user ID.
