# Trading Docks v248 — Deck replaceCard reference fix

Fixed the Vercel TypeScript error:

`Cannot find name 'replaceCard'`

The drag-and-drop Deck Builder no longer uses the legacy `replaceCard` handler,
but one stale prop reference remained in `DeckDetailWorkspace.tsx`. That
obsolete pass-through has been removed.

All drag-and-drop, section movement, trash, Undo, archive, empty-deck, and
permanent-delete behavior remains preserved.
