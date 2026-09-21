# Production POS installation execution — 2026-09-21

**PRODUCTION POS SCHEMA INSTALLED / POS DISABLED / PRODUCTION SQUARE DISABLED**

**PHYSICAL HARDWARE ACCEPTANCE PENDING / PHASE A CASH PILOT NOT YET RETRIED**

## Artifact-verification gate

Executed only `supabase/migrations/20260921220051_pos_forward_installation.sql`.

SHA-256: `995ba7c269204cbf8c967cf0c43da436c654ef1eaf198f2737dd5d5d7166a7e7`.

`tests/pos-forward-installation.sql` is a disposable pilot/security test, not production DDL. Its runner reads the canonical migration. No SQL was moved out of a test fixture and no migration semantics changed. Final verification found Git had normalized mixed line endings in the initial commit. The migration's original, successfully rehearsed bytes were retained; `.gitattributes` now disables text normalization for this one file and recognizes CR line endings for whitespace checks. Staged Git bytes, working file, rehearsal checksum and installed ledger SQL match exactly.

The execution wrapper added only transaction/lock controls, private pre/post verification, temporary verification snapshots and the exact migration-history record. A checksum-normalization error in the first local wrapper test caused a rollback; the comparison was corrected to hash raw bytes. The corrected wrapper passed on the fresh Supabase restore before production execution. No production retry or ad hoc schema patch occurred.

## Production execution

Project: Trading Docks, `bohddnajlnmknngzjsjk`, us-west-2, PostgreSQL 17.6 / build 17.6.1.147.

- Transaction start: **2026-09-21 22:39:06.370219 UTC**.
- All in-transaction verification passed: **2026-09-21 22:40:55.369595 UTC**; COMMIT followed successfully, CLI exit 0.
- Server-side verification span: approximately **109 seconds**, versus approximately 21 seconds for the complete wrapper locally. This includes full-row fingerprints and exhaustive object checks, not just DDL. Shared write-blocking locks protected the business-data comparison; no lock timeout or partial installation occurred.
- Migration ledger: **16 → 17**, adding only `20260921220051`, name `pos_forward_installation`, with exact canonical SQL in `statements[1]`.
- No historical Phase 1–6 migration was replayed. No compatibility migration or workspace assignment was reapplied to production.

| Invariant | Before | After |
| --- | ---: | ---: |
| Inventory rows | 1,515 | 1,515 |
| Inventory units | 1,788 | 1,788 |
| Inventory events | 1,550 | 1,550 |
| Unscoped inventory rows | 0 | 0 |
| Enabled POS workspaces | 0 (settings absent) | 0 |
| Square connections / credentials | 0 (objects absent) | 0 / 0 |

Full-row fingerprints of all 137 pre-existing application/Auth tables matched before/after inside the transaction. Owners, workspace associations, quantities, batch/location relationships, allocations, events and financial history were unchanged. The four compatibility repairs and authoritative workspace writer remain intact.

## Recovery verification

Original raw archive and role dump retained at their original timestamps and sizes; SHA-256 rechecks matched `2BA290B8075BB03BB3CBE248635361A9818203D69C7ADC30CC4C012FA3543D0E` and `93DEBA67858A97B67FB43E781B1A77E6B3DE47931E06E07E7F6D2746EA21BCA6`. All seven files in the previously verified Supabase-aware manifest also passed checksum verification.

A separate fresh backup of repaired production was created before installation in the owner/SYSTEM-access-restricted directory outside Git:

`C:\Users\Jerem\TradingDocksRecovery\trading-docks-production-pre-pos-install-20260921`

It contains CLI roles/schema/COPY data/explicit migration-history exports, managed customizations, current API ACL supplement and a SHA-256/timestamp manifest. All dump commands exited 0; fresh export files completed 22:30:58–22:31:53 UTC (data completed 22:31:40.615 UTC). Original artifacts were not overwritten. The fresh manifest was reverified after use. The new restore ran **22:33:40.152–22:33:57.294 UTC**, exit 0, in isolated `pos_install_recovery_current` on official Supabase PostgreSQL 17.6.1.167. Complete application catalog and all 138 table fingerprints including migration history matched live production. Auth linkage, permissions and original inventory data were preserved. The exact installation wrapper was then rehearsed on this recovered current state. No recovery target was attached to a runtime/network or external services.

This remains database recovery evidence; Storage file payloads, offsite recovery, application secrets and hosted platform cutover limitations are unchanged from the recovery report. No backup/customer contents or secrets are committed.

## Installed objects and security

Installed the [reviewed object manifest](pos-production-installation-objects.json): 43 tables / 340 new-table columns, 49 functions, 30 triggers, 197 table constraints plus three deferred-trigger constraint records, 98 indexes including constraint-backed indexes, and one private identity sequence. No new policies, schemas or custom enums. Existing label/Chaos/writer objects were retained; only the reviewed exact-stock collector permit hook extends an existing function.

The entire post-installation catalog matches the successfully rehearsed target. All new sensitive tables have RLS and no direct anonymous/authenticated table privileges. Browser roles cannot execute private helpers or server-only `pos_square_service`, or read Square secrets. Existing RLS/policies/grants were preserved.

Read-only production security checks: owner authority PASS without the former entitlement mismatch; owner bootstrap returns `POS_DISABLED`; cross-tenant authorization/read denied; anonymous RPC denied; browser service/helper/secret access denied. No production staff fixtures or delegated sales were created. Exact function/ACL equality ties deployed delegation/manager behavior to the passing rehearsal: manager status alone grants no other owner's stock; delegation stays owner/site-scoped, and revocation/general-write denial remain enforced.

Supabase security advisor: **101 existing warnings → 107 warnings; zero errors**. The six added warnings are `authenticated_security_definer_function_executable` for the six deliberately authenticated, authorization-checked POS RPC entry points. No new anonymous execution warning. The existing leaked-password-protection warning and pre-existing RPC warnings were not changed. These are recorded warnings, not a zero-warning claim.

Production Vercel environment metadata contains no `POS_*` or `SQUARE_*` settings. No credentials, merchant connection, terminal or enabled workspace was created. The existing Square runtime guard unconditionally rejects production even with Sandbox settings; local runtime/unit tests passed. No live checkout was attempted.

## Live checks and repository promotion

Pre-merge production checks passed: signed-in Dashboard, Inventory/Collection, Chaos Sort, Label Studio and Orders Center; POS renders the disabled-workspace gate. Checks were read-only: no checkout, import, print queue mutation or stock write. Public and post-deployment checks are recorded below when complete.

Local validation: `npm run validate` passed (ESLint, TypeScript, 960 unit tests, production dependency audit and Next.js build). No Expo/mobile runtime changes; no new Native build is claimed. The canonical migration is the only new migration in the PR; unrelated earlier local pilot/documentation commits are excluded.

## Completed repository and deployment verification

- Installation PR: [#121](https://github.com/tradingdocks-spec/Trading-Docks/pull/121).
- Merge SHA: `0e1bc539d3c326786f28cd26b9525a91a779f05d`.
- GitHub Actions [Quality and security run 35664360039](https://github.com/tradingdocks-spec/Trading-Docks/actions/runs/35664360039): PASS, including dependency install, full checks and web build. Vercel preview check: PASS.
- Production deployment: `dpl_HVWpHRZuoviFH6qQcXUYVYUk9eFx`, **READY** at **2026-09-21 22:50:03.299 UTC**, commit matches the merge SHA; production aliases include `www.tradingdocks.com` and `tradingdocks.com`.
- The SQL stored in production migration history and the canonical file fetched from `origin/main` both hash to the exact SHA-256 above. No repository/history mismatch remains.
- Public marketing homepage: HTTP 200 after deployment. Signed-in Dashboard, Inventory, Collection storage (`UC Bulk Boxes`), Chaos Sort intake, populated Label Studio targets and populated Orders Center all load successfully.
- POS register route: **POS is not available yet**. Payments page: **Connect Square Sandbox disabled**. No checkout, register session, staff delegation or merchant connection was created.
- Production log queries since 22:39 UTC and deployment-specific queries after release returned **zero 5xx, error or fatal entries in the observed window through approximately 22:52 UTC**. This is a bounded observation, not a claim about future traffic or unavailable retention.
- Final read-only database check at **22:50:15 UTC**: 1,515 rows, 1,788 units, 1,550 events, 0 unscoped, 0 enabled workspaces, 0 Square connections/credentials/devices, 17 ledger entries.
- Recovery container stopped again with original preload configuration restored; it remains network-disconnected. All backups and restore databases retained.

The documentation-only follow-up publishes these post-merge facts; it changes no migration, application behavior, configuration or rollout state.

No automatic workspace enablement or Phase A retry is authorized by this installation. Return to the owner gate after deployment verification.
