# Trading Docks v267 — Mission Control helper fix

Fixed the Vercel TypeScript error:

`Cannot find name 'buildAlerts'`

The Mission Control redesign called `buildAlerts(snapshot)` without including
the helper implementation.

This release:

- Adds the missing alert builder
- Generates failed-sync, open-order, and no-customer alerts
- Audits every `build*` helper used by Seller Mission Control
- Confirms all helper calls have matching declarations
- Preserves the complete v266 Mission Control redesign

No Supabase migration is required.
