# Active-capture capacity promotion

Status: **PRODUCTION SCHEMA VERIFIED — application PR/deployment pending.**

## Approved scope and clean dependency slice

Approved migration: `20260924220000_chaos_active_capture_capacity.sql`, with reviewed application/test changes from `223d728`.

The clean release branch is based on main `11f7ce472c7af66c8d5b8764ff02e6ab83ee827c`, freshly fetched before transplant. The owner approved the minimum dependency slice from `d8c980f` on 2026-09-24.

Only `src/components/dashboard/inventory/ChaosSortWorkspace.tsx` contains application hunks from `d8c980f`:

1. `removingRef`, autosave suppression during explicit removal, and cloud-confirmed `removeItems`; visible removal occurs only after RPC success, with partial-success state retained if a later removal fails.
2. Single-item, multi-select and Human state → Removed paths all use that authoritative removal handler. The review button is labeled Remove from batch and blocks active intake.
3. Kept-item queue counts, initial selection, commit counts and empty-state checks exclude removed captures. Image URLs are not revoked on removal.
4. Explicit next-batch resume identity prevents draft refresh from automatically arming replacement capture; automatic resume remains limited to the label-confirmed next batch.

From `223d728`: non-removed count on recovery, active physical count, full-state reset after acknowledged removal, the exact migration, DB/browser tests and capacity documentation. The browser fixture adds only the approved migration.

Excluded entirely: orientation module/metadata/rendering/buttons, recognition retry and credit messages, recognition-failure scanner behavior, LiveScanStation changes, scanner mock image overrides, unrelated usability tests/docs, agent and installer work. No other file from `d8c980f` is included.

## Read-only production baseline

Verified 2026-09-24 against the production project:

| Measure | Before | After |
| --- | ---: | --- |
| Inventory rows | 1,515 | Unchanged |
| Inventory units | 1,775 | Unchanged |
| Inventory events | 1,566 | Unchanged |
| Migration-history entries | 23 | 24 |
| CS-000023 active/lifetime captures | 1 / 1 | Unchanged |
| CS-000023 removed captures | 0 | Unchanged |
| Albums exceeding 100 active captures | 0 | Unchanged |
| POS-enabled workspaces | 0 | Unchanged |
| Square connections/credentials | 0 / 0 | Unchanged |

CS-000023 remains ACTIVE, live intake, destination UC Bulk Boxes. Its existing received capture has failed recognition. No capture was removed or created during preflight. Full inventory/event/batch/capture hashes and current RPC/policy definitions were recorded privately.

## Fresh recovery gate

**RECOVERY READY**, verified at 2026-09-24 20:45 UTC. The previous verified snapshot predates current events and the saved capture, so a fresh export and restore were required.

Artifacts remain outside Git under the access-restricted owner-controlled directory `C:\Users\Jerem\TradingDocksRecovery\trading-docks-pre-active-capacity-20260924`. No database contents or credentials are included here. Earlier backups remain preserved.

- Supabase CLI role, schema, data, migration-history, and explicit current Storage schema exports completed successfully.
- Data SQL: 278,418,731 bytes, SHA-256 `d30aa77b97d4f37018f723487b0ababb067e2d9c5069de08231c8e22cec9cbba`.
- Schema SQL SHA-256: `cd04771a5a3fce3214d5e1263b656605606820f17e81dbd6242a723bf27b72f3`.
- All nine manifest artifacts passed size and SHA-256 verification.
- Restored into a new isolated database on official `supabase/postgres:17.6.1.167`, PostgreSQL 17.6; the container has no network attachment or external application services.
- Successful restore: 20:38:30–20:38:56 UTC. Earlier failed attempts rolled back; production was never modified.
- Exact restored data hashes match inventory, events, positions, batches, sessions, captures, albums, and workspace memberships. Counts match 1,515 rows / 1,775 units / 1,566 events / 23 migrations.
- Functions, triggers, policies, RLS, indexes, enums, Auth relationships, effective application grants and extension versions match. Two CHECK definitions differ only in equivalent AND-expression parentheses after PostgreSQL dump/restore.
- Owner reads pass; cross-tenant and anonymous batch access are denied. Replication role is `origin`; zero application triggers remain disabled.

The older local Storage bootstrap lacked newer lifecycle fields. The successful rehearsal restored the exact production Storage schema rather than guessing missing definitions. The first metadata comparator also treated JSON object field order as a difference; parsed deep comparison verified identical values.

Limitations: this is database recovery, not a backup of Storage image payloads or external configuration/secrets. Separate exports were verified against source metadata. No claim of full external-service disaster recovery is made.

## Fresh-production-shaped migration rehearsal

**PASS** on isolated clone `chaos_capacity_1790282646509` of the verified fresh restore. Only the approved capacity migration was applied; no historical migrations were replayed. Synthetic test records were confined to the isolated database.

- Migration preserved inventory row/unit/event counts and all pre-existing capture row hashes.
- 100 active captures reject another capture; removal reduces capacity to 99.
- Repeated removal is idempotent; removed capture identity, ordinal and history are preserved.
- Twelve independent concurrent connections compete for the freed slot: exactly one succeeds, eleven receive `SCAN_BATCH_FULL`.
- Replacement has a new UUID and ordinal 101; lifetime count 101, active count 100, removed count 1.
- Direct deletion, identity changes, restoration and overflow are denied.
- Isolated commit includes exactly 100 kept units/events and excludes the removed record; closed batch stays immutable.
- Owner/cross-tenant/anonymous/private-table/RLS checks pass.

Clean release validation: TypeScript PASS; ESLint 0 errors/551 existing warnings; 1,014 root tests PASS; production dependency audit 0 vulnerabilities; production webpack build PASS; cloud-browser suite 5/5 PASS, including active capacity and removal persistence. The deliberate connection-reset/offline responses in the recovery test are expected fault injections. Fresh production-shaped concurrency/commit/security rehearsal repeated successfully. Mobile code is unchanged. GitHub CI remains a separate pre-merge gate.

## Production execution

Only `20260924220000_chaos_active_capture_capacity.sql` applied, 2026-09-24 **21:02:03.660–21:02:06.594 UTC**, CLI exit 0. Approved SQL SHA-256 (Git bytes): `79bdadea6d391c84204c15b7bdbdd33a8d21dd99d37b96ebac1d4b7102cae1ab`.

The transaction ran reviewed SQL with pre/post assertions and recorded the exact canonical SQL under ledger version `20260924220000`. No historical migration or manual business-row repair ran. The same execution wrapper passed on a fresh-restored clone first. Lock acquisition was bounded to five seconds.

Independent post-commit reads confirmed all inventory/event/position/batch/session/membership/capture/album data hashes unchanged. Counts remain **1,515 / 1,775 / 1,566**. Migration history is 24. One private slot represents CS-000023's one original active capture; no invalid mappings or over-capacity albums. Capture and capacity RLS are enabled; browser/service roles have no private-slot privileges. Authoritative RPC grants are unchanged. All post-migration functions/policies/RLS/grants metadata matches the rehearsed target. Zero POS-enabled workspaces and zero Square connections/credentials remain.

## Remaining deployment gate

Create the focused PR, require clean CI, merge, and verify Vercel and production UI. No production capture removal or inventory commit is used solely for testing; boundary mutations and concurrency were rehearsed in isolated databases.

No PR, merge SHA, or new deployment is recorded yet.
