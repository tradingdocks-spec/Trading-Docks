# Chaos cloud intake-mode repair

Implemented: synchronized drafts can switch Live Scan / Upload Images / CSV.
Physical iX500 capture acceptance remains pending; no certification change.

## Root cause and repair

`ChaosSortWorkspace` disabled the selector when `albumReady` was true. Removing
that condition alone would still leave cloud `intake_mode` unchanged: creation
was the only command that wrote it. The `mode` command now updates only the open
album's intake metadata under the existing owner/active-workspace checks and
transaction locks. It validates the requested mode and expected prior mode,
rejects pending capture/recognition work, and preserves closed-batch immutability.
A stale browser cannot start the scanner on a non-live album.

The UI waits for the server response before switching. Pending changes, uploads,
staged files, recognition, scanner commands and commit lock out mode switches.
Failure retains the old mode. The existing mounted LiveScanStation, pairing,
destination, settings and batch identity remain intact. Recovery reads the mode
from the album; a second browser sees it on load/refresh. This does not introduce
live synchronization of an already-open idle second browser.

## Validation

- Baseline and final root checks: 1,004 tests; TypeScript; lint zero errors
  (548 preexisting warnings); dependency audit zero vulnerabilities.
- Production build: PASS. Secret audit: PASS, 273 files, no findings.
- Real disconnected Supabase PostgreSQL rehearsal: 19 assertions, including
  upload/live/CSV transitions, response-loss retry, stale-mode rejection,
  pending reservation/recognition denial, closed denial, anonymous/cross-tenant/
  inactive-workspace denial, destination/device/settings preservation, no second
  batch and no inventory/event mutations from changing modes.
- Three real-browser mode scenarios: PASS. Separate browser profile persistence,
  refresh, pairing retention, failed/pending save, staged upload, recognition and
  busy scanner protection covered.
- Existing private-album 100-card browser workflow: PASS, including closed mode
  selectors, card 101 rejection, review, commit, label gate, next batch and recovery.
  Scanner transport/recognition are deterministic fixtures, not physical acceptance.

## Production schema-first execution

Applied only `20260924043103_chaos_intake_mode_switch.sql` at
2026-09-24 04:41:59.824–04:42:01.153 UTC, transactionally with drift/invariant gates.
No historical migration changed. Migration ledger: 22 -> 23.

Preflight: 1,515 inventory rows, 1,777 units, 1,564 events; 23 batch headers;
zero captures; CS-000023 ACTIVE/upload at its existing destination. One
`quantity_removed` event dated 03:26:14 UTC explains the count change since the
previous task; this repair neither reverses nor repeats it.

Whole-row inventory, batch and album hashes and function grants were unchanged
by the migration. Production function hash matches the rehearsed definition.
Rollback-only owner RPC verification on CS-000023 succeeded; mode reverted to
upload with the transaction rollback. No inventory commit occurred.

Seven existing recovery artifact hashes/sizes verified; no artifacts overwritten.
Exact pre-change function saved outside Git under the owner's restricted recovery
folder `chaos-intake-mode-20260924/rollback-function.sql`. This is a function-only
repair, not a data backfill. For rollback, revert the web UI first, then apply a
reviewed forward function restoration; preserve existing albums and history.
The existing full backup predates the latest removal; it is not represented as
a fresh full-database restore point for that later business event.

Hosted security advisor findings unchanged: no additions/removals. RLS, grants,
POS disablement, production Square and scanner owner-only gate unchanged.

Application promotion and physical one-card checkpoint: pending deployment.
Stop before inventory commit; physical scan must be performed by the owner.
