# Trading Docks v270 — Binder import-boundary fix

Fixed:

`Module '"react"' has no exported member 'ArrowLeft'`

The full opening import section of `TieredInventoryWorkspace.tsx` was rebuilt.

Correct package boundaries:

- `Link` from `next/link`
- React hooks from `react`
- `createPortal` from `react-dom`
- All UI icons from `lucide-react`

The user-facing phrase “Instagram and Discord” remains intentionally in the
social-export copy. The unsupported `Instagram` Lucide import and JSX component
remain removed.

Binder Showcase Studio, public links, social export, and trade captions are
preserved.

Existing migration:

`supabase/migrations/202608030009_binder_shares.sql`
