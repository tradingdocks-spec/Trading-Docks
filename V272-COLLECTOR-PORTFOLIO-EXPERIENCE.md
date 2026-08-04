# Trading Docks v272 — Collector Portfolio Experience

This release makes the Collector Portfolio visibly separate from the private
Virtual Binder editor.

## Existing binder changes

- New **Open Portfolio View** button in the binder header
- New editor-versus-portfolio explanation banner
- New **Open Portfolio Experience** call to action
- Quick Export remains available for fast social graphics
- Existing showcase modal now links directly to the full Portfolio experience

## New immersive binder route

`/dashboard/collector-portfolio/binder/[locationId]`

The immersive private viewer includes:

- Full binder spread
- Interactive flipbook
- Full-page gallery
- Keyboard navigation
- Focus mode
- Permanent right-side card spotlight
- Optional value overlays
- Page progress rail
- Direct Showcase Studio entry
- No scrolling left navigation inside the binder experience

## Collector Portfolio integration

Binder covers and the Featured Binder now open the immersive viewer instead of
returning users to the inventory-style editor.

No new Supabase migration is required beyond the v271 Collector Portfolio
foundation migration.
