# Chaos kept-card capacity readiness

Status: Implemented and rehearsed locally. NOT applied to production. No deployment authorized by this report.

## Forward migration

`20260924220000_chaos_active_capture_capacity.sql`

Requires the existing cloud-authority, tenant-isolation, and intake-mode repair baseline. Historical migrations are unchanged. Apply this migration before promoting the browser change, after a separately approved production preflight/recovery gate.

## Enforcement and audit

- Active capacity is every capture with status other than `REMOVED`, including reservations and incomplete uploads. A slot is not released just because a request times out. An interrupted reservation can be explicitly removed when intake is idle, but cannot be reviewed as received before upload.
- Lifetime ordinal remains positive, unique within the album, and immutable. It can now exceed 100. New captures use fresh IDs and `max(ordinal)+1`; neither IDs nor ordinals are reused.
- Private `chaos_scan_private.capture_capacity` holds one slot per active capture. Slot range 1–100 and unique `(album_id,slot)` enforce the bound even under concurrent writes. Existing captures backfill this metadata without rewriting capture rows.
- The trigger locks the album, requires ACTIVE state, allocates on insert, and releases only on removal. Capture deletion and identity changes are rejected. Removed records cannot be edited or restored. Repeated removal returns the existing revision without changing history.
- Existing RPC authorization, RLS, workspace checks, storage access, revision checks, and commit authority remain unchanged. The new private table has RLS and no application-role grants.
- Snapshots, history, committed physical count, and browser counters use non-removed captures. The immutable commit includes only `RECEIVED` captures. Removed source images remain private and traceable.
- Removing at 100 releases the full-batch latch after the cloud save succeeds. Intake requires an explicit arm action; removal does not automatically run the scanner.

## Rehearsal evidence

Network-isolated Supabase PostgreSQL 17, disposable databases `chaos_capacity_1790281064896` (received removal) and `chaos_capacity_1790281387790` (interrupted reservation removal); no hosted backend was used. Both runs passed.

- Migration applied to an existing 100-capture fixture album; capture-row hash and inventory/quantity/event baseline unchanged.
- 100 active rejects another capture. Removal gives 99. Repeated stale removal is idempotent and preserves the exact tombstone.
- Twelve independent PostgreSQL connections competed for one vacancy: one accepted, eleven `SCAN_BATCH_FULL`.
- Replacement has ordinal 101 and a fresh UUID; lifetime rows 101, active slots 100, removed rows 1.
- RPC restoration denied both below and at capacity. Trusted direct overflow, deletion, restoration, and ordinal rewrite denied.
- Owner succeeds; cross-tenant, anonymous, and direct private-slot access denied; capture RLS remains enabled.
- Commit created exactly 100 kept inventory units and 100 events. Removed card absent; tombstone unchanged; post-commit review denied.
- Browser test: 99 → scan to 100 → remove to 99 → refresh → replacement to 100 → commit 100. Same batch/destination, 101 preserved private images, new replacement identity, Print Batch Label shown.

Commands: `node tests/chaos-active-capacity-db.mjs` and `npx playwright test --config playwright.scan-albums.config.ts tests/scan-albums/active-capacity.spec.ts`.

Final validation: full cloud-browser suite 6/6 passed; root suite 1,014/1,014 passed; TypeScript and production webpack build passed; ESLint zero errors (repository warnings remain; new tests clean); changed-file secret/artifact audit and `git diff --check` passed.

## Production gate (not executed)

Inspect current migration history and function definitions; verify approved recovery readiness and no active scanner operations. Record inventory row/unit/event counts and capture identity hashes. Check:

```sql
select album_id,count(*) as lifetime,
 count(*) filter(where status<>'REMOVED') as active,
 max(ordinal) as highest_ordinal
from public.chaos_scan_captures group by album_id;
select album_id,count(*) from public.chaos_scan_captures
where status<>'REMOVED' group by album_id having count(*)>100;
select pg_get_functiondef('public.chaos_scan_command(text,jsonb)'::regprocedure);
select pg_get_functiondef('public.chaos_batch_history(timestamptz,uuid,integer)'::regprocedure);
```

Stop for any over-capacity baseline, missing reviewed function anchors, unexpected authorization changes, or missing recovery evidence. The migration itself fails on baseline drift or slot overflow.

After application, compare the recorded immutable row hashes and inventory counts, then verify:

```sql
select c.capture_id from public.chaos_scan_captures c
left join chaos_scan_private.capture_capacity s on s.capture_id=c.capture_id
where (c.status<>'REMOVED' and (s.capture_id is null or s.album_id<>c.album_id))
   or (c.status='REMOVED' and s.capture_id is not null);
select album_id,count(*) from chaos_scan_private.capture_capacity
group by album_id having count(*)>100;
select relname,relrowsecurity from pg_class
where oid in ('public.chaos_scan_captures'::regclass,
 'chaos_scan_private.capture_capacity'::regclass);
```

The first two checks must return no rows. Review grants and original RPC security configuration before any browser smoke test.

## Locking and recovery

The atomic migration locks the album/capture tables, scans existing captures for the new positive-ordinal check, and inserts private capacity metadata. Lock acquisition times out after five seconds rather than waiting indefinitely. Runtime scales with lifetime capture count; production runtime has not been measured. Use a quiet intake window and stop active scanner sessions first.

Before commit, any migration failure rolls back all DDL/metadata. After acceptance of ordinal 101+, do not restore the old ordinal≤100 constraint or delete history to make rollback fit. Pause intake, retain the new schema/history, and repair forward. A previous web build may remain conservatively full because it counts lifetime rows; it must not be used to resume replacement intake. Never roll back unrelated inventory or financial history.

POS, Square, hardware certification, production data, and the installed agent remain unchanged.
