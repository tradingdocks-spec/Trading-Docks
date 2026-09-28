# Chaos database-first promotion — September 27, 2026

Status: **READY FOR DATABASE-FIRST RELEASE under the owner's revised dependency-delta gate.** Functional validation passes. A fresh matched main/promotion audit confirms the mobile 6 high / 19 moderate findings are pre-existing baseline security debt with no newly exposed relevant attack path. See `CHAOS_DEPENDENCY_SECURITY_DELTA.md` and the separate `MOBILE_BASELINE_SECURITY_REMEDIATION.md` follow-up. This status authorizes PR preparation only; no hosted migration, merge or deployment has been performed.

## Scope and baseline

- Branch: `codex/chaos-ricoh-upload-promotion`.
- Refreshed `origin/main` and starting HEAD: `13766d473d72451dd164b5ae1ce4baa69ce94f19`.
- Current main is authoritative. Selected source changes were integrated semantically; original feature history was not merged.
- Mobile runtime, POS/storefront implementation, root/mobile dependency manifests and lockfiles, deployment configuration and existing migrations are unchanged.
- Production access in this work was read-only catalog inspection. No production inventory rows, staging credentials, staging restore or Docker operation were used.
- This report supersedes the implementation status in `CHAOS_PROMOTION_COMPATIBILITY_GATE.md`, which remains historical evidence of the earlier deployment gate. Its finding that merging main automatically deploys Vercel remains relevant: database release must precede application merge.

## Nine overlap resolutions

| File | Resolution preserving current main |
| --- | --- |
| `docs/SCANNER_AGENT_RESTART_REPAIR.md` | Retained historical 1.3.1 lifecycle findings; added current 1.4 integration note. |
| `scanner-bridge/Windows/Program.cs` | Preserved dispatcher, lifecycle, host and relaunch; integrated encrypted recovery, capture authorization and TWAIN wiring. |
| `src/app/api/chaos-sort/scans/route.ts` | Retained unconditional owner-only capture-permit authorization; added paired image upload/retrieval and removed-capture rejection. No private acceptance bypass. |
| `src/components/dashboard/inventory/LiveScanStation.tsx` | Preserved recovery latch, heartbeat, confirmed cancellation and next-batch behavior; added back-image transport and updated labels. |
| `src/lib/chaos-sort/local-scanner-provider.ts` | Preserved confirmed-cancellation error handling; added device diagnostics, TWAIN defaults and duplex decoding. |
| `tests/helpers/mock-scanner-bridge.ts` | Preserved durable/interrupted recovery, capture requests and renewal fixtures; updated visible labels. |
| `tests/scan-albums/album.spec.ts` | Preserved recovery and print gates; updated selectors for the promoted UI. |
| `tests/scanner-bridge.test.ts` | Retained cancellation regressions and added duplex coverage. |
| `tests/scanner-bridge/bridge.spec.ts` | Retained heartbeat/recovery/cancellation assertions; updated scoped selectors and failure diagnostics. |

The workspace preserves main's autosave/removal interlock and exact resume-batch selection. Upload supports multiple front images, four recognition workers and the 100-active-card ceiling. Staged images no longer double the displayed active-card count. Review, manual rotation/re-recognition and irreversible removal use the existing cloud authority. Original JPEGs remain immutable; normalization is applied for recognition. Retention deletes both image sides only for expired closed albums, skips non-image paths and does not update immutable closed captures. Removed images become unreadable immediately; physical object cleanup follows album retention.

## New forward migration

File: `supabase/migrations/20260927163241_chaos_scan_images_forward.sql`.

SHA-256: `699269574C3B61EB506FE59E053B24A1C0204C10C25ED7FB1129F126DCF5F522`.

The old `20260927033250_chaos_staging_baseline_reconciliation.sql` remains untouched in the original checkout and is excluded from promotion. Its preserved SHA-256 is `FB4B4DEC1376A35B1E3C3CD5610083F6E01DB85AAEC5E99992CD980BD6503792`. Neither it nor obsolete historical migrations may be applied as part of this release.

Production catalog inspection found the Chaos foundation, capacity safeguards and irreversible removal already installed. The minimal missing contract is paired back-image storage:

1. Add nullable `back_object_path` and `back_sha256` to `public.chaos_scan_captures`.
2. Add back-path uniqueness, SHA-256 validation and paired-field/front-derived-path constraints.
3. Add a private, SECURITY INVOKER, empty-search-path update trigger preventing changes to paired image identity. Direct execution privileges are revoked.
4. Update the two scan storage read/insert policies for front/back paths under existing owner/album/workspace authorization; removed/expired images are unreadable.
5. Replace `chaos_scan_command(text,jsonb)` with its installed implementation plus pair reservation, hash idempotency and uploaded-back checks. Late receipt of a removed capture returns its tombstone unchanged.

No inventory recalculation, reservation, decrement, allocation change, ledger rewrite, position creation, workspace rewrite or storefront mutation occurs. There is no scan-data backfill. Existing rows receive null optional fields. Existing capacity and inventory commit functions remain byte-for-byte unchanged in the native fixture.

The migration is transactional and fail-closed. It checks installed command/capacity function source hashes, enabled capacity trigger, scan RLS and restrictive active-workspace policy before applying. It uses a 5-second lock timeout and 30-second statement timeout. Exclusive scan-table locks can briefly block scan traffic; perform the eventual release during an owner-controlled idle period. A second application fails safely instead of pretending migration history is reconciled.

## Authorization and compatibility findings

The installed RPC is SECURITY DEFINER with an empty search path and explicit owner/workspace/member checks. Anonymous/public execution is denied. Existing capture visibility follows album visibility; album visibility includes a restrictive active-workspace policy. The new storage policy retains those boundaries. Native tests exercise cross-owner/workspace rejection and denial of direct writes.

Old application selects and single-front reservation continue working after the additive migration in the fixture. New application upload, front retrieval, review, removal and commit work against the migrated fixture. This is backward/forward contract evidence, not production acceptance. The new application must not deploy before the migration because it requests the added columns.

## Observed validation

Logs are retained locally under `.cache/promotion/` (ignored, not release artifacts).

| Validation | Observed result |
| --- | --- |
| Root unit/contract suite | PASS: 1,029 tests |
| Root TypeScript / ESLint | PASS: no errors; 551 existing lint warnings |
| Next.js production build | PASS |
| `git diff --check` | PASS using repository line-ending configuration |
| Root production dependency audit | PASS: zero vulnerabilities |
| Mobile unit suite | PASS: 580 tests |
| Mobile TypeScript / ESLint | PASS: no errors; 3 lint warnings |
| Mobile production dependency audit | **FAIL: 6 high, 19 moderate; unchanged main dependencies** |
| Scanner core/security contracts | PASS: 411 assertions |
| Windows scanner checks | PASS: 7 checks |
| Release Windows agent, x86 TWAIN worker and installer build | PASS using installed .NET SDK supporting the project target |
| TWAIN worker transitive NuGet audit | PASS: no vulnerable packages reported |
| New complete migration on isolated PostgreSQL 17.10 | PASS: 44 checks |
| POS/inventory native database contracts | PASS: 132 checks with text ledger and 132 with enum ledger |
| Simulated upload browser suite | PASS: 6 cases |
| Native SQL album/capacity/intake browser suite | PASS: 5 cases |
| Native SQL front upload/review/removal/commit browser regression | PASS: 1 comprehensive case, one image then ten distinct images |
| Native SQL workstation browser suite | PASS: 9 cases |
| Scanner browser suite | PASS across final run (5 cases) and focused rerun (1 case after scoping an ambiguous selector) |

The 44 database checks execute the entire new migration against production-derived scan function definitions, repository scan DDL and synthetic surrounding tables. They demonstrate unchanged pre-existing rows, paired identity, front/back completeness, idempotency, tenant/workspace isolation, immutable removal, stale-write rejection and unchanged old application operations. Twelve concurrent reservations for one remaining slot accept exactly one. Removing/replacing retains 100 active cards across 101 lifetime captures. Commit creates 100 units/events once. The seeded item with five authoritative units and two positions (2 + 3) remains **5, never 10**. POS/storefront sentinel rows remain identical.

The new browser regression uses the actual local application route and PostgreSQL RPC: one front becomes one card, low-confidence Review persists, rotate/re-recognize/correction/confirmation persist, removal survives refresh and stale state cannot resurrect it. Ten distinct front images become ten captures; destination and recognition state persist; commit/retry yields ten inventory rows and ten ledger events without duplication.

Limits: the database fixture is not a faithful full production restore. Surrounding schema/data and recognition responses are synthetic; storage is a local private adapter. Physical Ricoh feeding/pair matching and real recognition-provider accuracy were not tested. Docker-only/hosted acceptance scripts were not run; native coverage is explicitly listed above. No Expo web/native packaging or device acceptance is claimed. Current production inventory baselines, backup/PITR and postflight have not been verified.

## Security gate

The initial absolute audit gate blocked preparation. The owner subsequently authorized a dependency security delta gate. Fresh matched audits confirm identical advisory/version/path findings on current main and promotion: 6 high / 19 moderate, with zero new findings. They remain audit failures and are classified as **PRE-EXISTING BASELINE SECURITY DEBT**; no force-fix or unrelated mobile upgrade was performed. Detailed runtime exposure and the separately tracked remediation are linked above.

## Reproduction and next authorized steps

Run from the promotion worktree:

```powershell
npm run check
npm run build
npm --prefix mobile test
npm --prefix mobile run lint
Push-Location mobile
npx tsc --noEmit
Pop-Location
npm --prefix mobile audit --omit=dev --audit-level=high
node tests/chaos-scan-images-forward-db.mjs
npm run test:pos:db
npx playwright test --config playwright.chaos-upload.config.ts
npx playwright test --config playwright.scan-albums.config.ts
npx playwright test --config playwright.chaos-live.config.ts
npx playwright test --config playwright.scanner-bridge.config.ts
git diff --check
Get-FileHash supabase/migrations/20260927163241_chaos_scan_images_forward.sql -Algorithm SHA256
```

Native database tests require `embedded-postgres` 17.10 and `pg` under ignored `.local-fixtures/pos-db/node_modules`; this run reused the already installed local fixture dependencies through a directory junction. Browser fixtures also require a PostgreSQL 17 `psql` client (`TD_TEST_PSQL`, or their documented existing local-tool fallback). Only the client binary from the prior tools directory was used; no staging backup, password or database was accessed. Fixtures bind loopback and do not read hosted application environment files. Browser suites must run sequentially on their dedicated ports; avoid a second browser editing the same fixture draft during a test.

The dependency-delta gate is satisfied. Review the complete diff, rerun affected checks, commit application and new migration separately, push this focused branch and create a PR. Do not merge. Future production actions each require the owner's separate authorization:

1. Verify a recoverable production backup/PITR point, recording its identity, timestamp and tested recovery procedure. Capture authoritative inventory, positions, events, allocations, workspace and POS baselines in read-only transactions. `supabase/verification/chaos-scan-images-forward-preflight.sql` provides read-only scan/schema checks and independently aggregated inventory fingerprints; supplement with complete workspace/POS baselines. Its parent-quantity computation uses EXISTS to avoid position join multiplication. It was exercised locally, not run on production.
2. Revalidate the migration hash and live schema against the reviewed assumptions. Stop on drift. Obtain explicit migration authorization, then apply **only this new migration** using a reviewed migration-aware operation that records its genuine successful application. Do not use an unfiltered historical migration push, replay obsolete SQL, manually patch objects or mark unapplied migrations as applied.
3. Immediately compare inventory/position/event/allocation/workspace/POS baselines, function security/capacity guards and old-application scan behavior. Stop on any discrepancy.
4. Only after successful postflight and separate merge authorization, merge the reviewed application PR; Vercel then deploys from main. Verify the new application contract and controlled owner acceptance.

On SQL failure the transaction rolls back; investigate rather than bypassing the preflight. After a successful additive migration, prefer retaining the additions while rolling the application back if needed. Do not drop populated capture columns or edit tombstones as an ad-hoc rollback. Any database restore must use the verified recovery procedure under owner authorization and account for writes since the recovery point.
