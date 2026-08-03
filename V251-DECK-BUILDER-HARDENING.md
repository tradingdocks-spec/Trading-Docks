# Trading Docks v251 — Deck Builder hardening

Fixed the Vercel TypeScript error:

`Cannot find name 'setSelectedCardId'`

## Root cause

The selected-card state belongs to the child deck-view component. The restored
replacement handler and modal callback were in the parent component and could
not access that state.

## Fix

- Removed only the two invalid parent-scope calls
- Preserved all legitimate child selected-card behavior
- Verified the replacement handler and modal contract
- Verified router, category inference, add-card destination, drag handlers,
  trash, deletion, and lifecycle actions
- Verified the mobile quick-add prop signature accepts an optional destination
- Scanned all source files for malformed nested imports
- Checked the modified TSX file for balanced delimiters

No new Supabase SQL is required.
