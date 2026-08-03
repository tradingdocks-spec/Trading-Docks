# Trading Docks v252 — Deck Builder compile hardening

This release fixes the latest Vercel TypeScript error and audits every symbol
introduced by the Deck Builder drag-and-drop work.

## Fixed

- Replaced nonexistent `setSaveStatus("Saving…")`
- Uses the component's actual `setSaveState("saving")` state setter
- Confirmed replacement handler does not reference child-only selection state
- Confirmed all drag, move, remove, add, replacement, router, and delete
  handlers have declarations/imports
- Confirmed all new state setters are declared
- Confirmed mobile quick-add accepts an optional deck destination
- Scanned the project for malformed nested imports
- Checked the modified file for balanced delimiters

No new Supabase SQL is required.
