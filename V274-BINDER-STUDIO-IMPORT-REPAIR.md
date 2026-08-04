# Trading Docks v274 — Binder Studio import repair

Fixed the Turbopack parser failure:

`Expected ',', got '{'`

The opening imports in
`src/components/dashboard-v2/inventory/TieredInventoryWorkspace.tsx`
had been merged into the Lucide icon block.

This release rebuilds the entire import header explicitly:

- `Link` from `next/link`
- React hooks from `react`
- `createPortal` from `react-dom`
- All UI icons from `lucide-react`

The full v273 Binder Studio redesign is preserved:

- Page rail
- Permanent live inspector
- Single Page, Spread, and Index views
- Drag-and-drop pockets
- Put-Away and undo workflow
- Portfolio View integration

No new Supabase migration is required.
