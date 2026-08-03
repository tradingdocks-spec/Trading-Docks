# Trading Docks v258 — Deck Studio scope fix

Fixed:

`Cannot find name 'mainDeckCount'`

A supplemental Deck Studio footer was accidentally inserted outside
`CardsWorkspace`, after the showcase component. Its local metrics were therefore
out of scope.

The misplaced footer has been removed. The Deck Studio command bar already
shows card count, unique count, deck value, and autosave status.

All v257 Deck Studio visuals and existing deck features remain preserved.

No Supabase migration is required.
