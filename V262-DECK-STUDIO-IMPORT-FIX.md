# Trading Docks v262 — Deck Studio import fix

Fixed the Vercel TypeScript error:

`Module '"react"' has no exported member 'AlertTriangle'`

The Deck Studio icon imports were accidentally merged into the React import.

This release restores:

- React hooks and React types from `react`
- Navigation hooks from `next/navigation`
- All interface icons from `lucide-react`

The complete v261 Deck Studio redesign is preserved.

No Supabase migration is required.
