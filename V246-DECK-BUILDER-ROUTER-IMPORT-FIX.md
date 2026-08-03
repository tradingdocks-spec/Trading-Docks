# Trading Docks v246 — Deck Builder Router Import Fix

Fixed the Vercel TypeScript error:

`Cannot find name 'useRouter'`

The Deck Builder uses `useRouter()` after permanent deck deletion to return the
user to Deck Vault. The hook is now imported from `next/navigation`.

All v245 drag-and-drop, trash, Undo, archive, empty-deck, and permanent-delete
features are preserved.
