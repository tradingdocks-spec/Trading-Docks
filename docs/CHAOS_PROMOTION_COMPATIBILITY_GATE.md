# Chaos promotion: deployment and database compatibility gate

Historical checkpoint. See [current integration and validation report](CHAOS_DATABASE_FIRST_PROMOTION.md) for the subsequent forward migration and implementation. The status and unchanged-source statements below describe this earlier checkpoint, not the current worktree.

Status: **BLOCKED — stopped under the owner's explicit deployment compatibility gate. NOT READY FOR PR.**

Inspected September 27, 2026 (America/Phoenix). This is a report of observed configuration/schema and source inspection, not completed semantic integration or production acceptance.

## Isolated branch

- Starting `origin/main`: `13766d473d72451dd164b5ae1ce4baa69ce94f19` (fresh fetch).
- New branch: `codex/chaos-ricoh-upload-promotion`.
- Worktree: `C:\Users\Jerem\.codex\worktrees\chaos-ricoh-upload-promotion\Trading-Docks`.
- Current HEAD remains the starting main SHA. No promotion commit exists yet.
- No feature commits were merged/cherry-picked and no runtime source was copied. The only new worktree file is this report, initially uncommitted.
- Original branch `codex/chaos-prehosted-rehearsal` and its uncommitted/untracked source material were preserved. No whole-file ours/theirs resolution occurred.
- All newer main functionality remains unchanged, including capacity, storefront, inventory, POS, migrations and scanner 1.3.1 lifecycle work.

## Vercel: main automatically deploys production

Live read-only project metadata:

| Setting | Observed value |
| --- | --- |
| Project | `trading-docks-346a` / `prj_cthg5hX2ehylcwdnPMPw5ASyfRZX` |
| Git provider/repository | GitHub / `Trading-Docks` |
| Production branch | `main` |
| `gitProviderOptions.createDeployments` | `enabled` |
| Ignored build command | null |
| Automatic custom-domain assignment | true |
| Build/install overrides | null; Next.js framework defaults |
| Main's repository build | `next build` |

This is corroborated by the latest [production deployment](https://vercel.com/tradingdocks-specs-projects/trading-docks-346a/4C7g7yNoCfBQrsxPdBkvh6BXXDNq): `dpl_4C7g7yNoCfBQrsxPdBkvh6BXXDNq`, source `git`, target `production`, state `READY`, branch `main`, commit `13766d473d72451dd164b5ae1ce4baa69ce94f19`. Earlier main merges likewise have production deployments. A code merge is therefore not a code-only operation under current settings.

Project inspection used authenticated Vercel CLI GET requests after the connector's project-details operation encountered a parameter-schema mismatch. No project/environment settings were changed and no secret values were displayed. Listing deployments did not create deployments.

The inspected `.github/workflows/quality.yml` runs install/check/build on main pushes and PRs. No database migration runner appears in that workflow, package build scripts or Vercel build overrides. Database migrations require a separate authorized operation in the inspected release path; a Git merge does not satisfy that step. External organization automation beyond the inspected repository/project is not certified absent.

The existing daily `/api/buylist/mtgjson` cron remains configured at `15 16 * * *`. It is not a database migration job and was not triggered or changed. No additional production workflow was introduced.

## Production schema — read-only observations

Project inventory identifies `bohddnajlnmknngzjsjk` as Trading Docks production, PostgreSQL 17.6.1.147. Only catalog/migration metadata was queried, inside explicit read-only transactions. No customer rows, inventory counts, backup operations, mutation RPCs or DDL/DML were requested.

Production already has:

- `public.chaos_scan_albums`, `public.chaos_scan_captures`;
- `public.chaos_scan_command(text,jsonb)` and `chaos_scan_private`;
- recorded scan foundation `20260923204804`, cloud authority `20260924000100`, legacy normalization `20260924005111`, mode switch `20260924043103`, and active capacity `20260924220000`;
- irreversible-removal command marker; no duplex/back-hash command marker.

Observed capture columns, in order:

```text
capture_id, album_id, user_id, ordinal, object_path, sha256,
status, item, captured_at, revision, source_kind
```

Absent feature fields: `back_object_path`, `back_sha256`, `removed_at`, `artifacts_purged_at`.

## Concrete application incompatibility

The original feature working tree's scan-image GET always selects `object_path,back_object_path,status`, including when only the front is requested. Production lacks `back_object_path`. That query would fail and the handler would return “Scan unavailable” for front images as well. This is a source/schema incompatibility finding; no production request was made to exercise the failure.

The feature retention script also selects back-image/removal/purge fields that production does not have. It cannot be enabled unchanged. Duplex reservation/upload needs a corresponding command/storage contract. These requirements cannot be met by assuming the old staging reconciliation is valid for production.

Main's existing front-image GET selects only `object_path,status`; it is preserved unchanged in this worktree. A future front-only promotion could preserve that contract and explicitly isolate optional duplex/retention work. Such an adapted implementation has not yet been built or validated here.

## Migration decision: do not carry the staging candidate as a production upgrade

Original candidate: `20260927033250_chaos_staging_baseline_reconciliation.sql`.

Unchanged raw SHA-256:

```text
FB4B4DEC1376A35B1E3C3CD5610083F6E01DB85AAEC5E99992CD980BD6503792
```

It was not copied into the promotion branch, modified, or applied. Reasons:

1. It explicitly rejects existing scan tables/private schemas. Production already has them, so its preflight would raise `CHAOS_RECONCILIATION_ALREADY_INSTALLED_OR_DRIFT`. It is a staging-gap installation, not a production forward upgrade.
2. Main's newer `20260924220000_chaos_active_capture_capacity.sql` introduces `chaos_scan_private.capture_capacity`, unique `(album_id,slot)` capacity protection, `enforce_capture_capacity()`/`scan_capture_capacity`, immutable capture identity/history, and removal of failed reservations. The old candidate's count-based capacity implementation does not incorporate this stronger contract. It must not replace it.
3. The earlier standalone removal/duplex migration `20260927013023` also cannot be replayed blindly: its `SCAN_CAPTURE_REMOVED` marker rejection encounters main's already-installed `SCAN_CAPTURE_REMOVED_IMMUTABLE` behavior. It also repeats the ordinal change. Current capacity's immutable-removed-row trigger conflicts with later retention updates to removed captures; any required metadata exception must be narrowly designed and reviewed, not achieved by disabling the trigger.
4. **New candidate defect found during inspection:** the dynamically constructed snapshot SQL at line 30 omits the empty-string operands in `string_agg`/`coalesce`. Parsing the generated SELECT offline reports `syntax error at or near "order", at index 64`. The earlier outer SQL/PLpgSQL grammar checks and isolated function tests did not execute or parse this dynamically generated statement. Full migration execution was always pending. The reviewed hash does not imply this candidate is executable, even for its original staging target.

Any future database work requires a **new separately reviewed, narrowly scoped forward candidate** against production's actual current baseline. Preserve the capacity-slot constraint/trigger, current removal semantics, RLS/authorization and storefront/POS contracts. Do not reuse the staging candidate filename/hash for changed SQL, replay old foundations, or manufacture migration history. No updated executable migration was authored after this stop condition; the required replacement scope is documented here for review.

## Previously identified conflicts

The gate was checked before semantic integration. None of these nine overlaps has been resolved or claimed equivalent:

| File | Resolution status |
| --- | --- |
| `docs/SCANNER_AGENT_RESTART_REPAIR.md` | Pending — current main retained |
| `scanner-bridge/Windows/Program.cs` | Pending — current main startup/lifecycle retained |
| `src/app/api/chaos-sort/scans/route.ts` | Pending — current main owner authorization/capacity and front-image path retained |
| `src/components/dashboard/inventory/LiveScanStation.tsx` | Pending — current main recovery/cancellation behavior retained |
| `src/lib/chaos-sort/local-scanner-provider.ts` | Pending — current main provider behavior retained |
| `tests/helpers/mock-scanner-bridge.ts` | Pending — current main fixture retained |
| `tests/scan-albums/album.spec.ts` | Pending — current main tests retained |
| `tests/scanner-bridge.test.ts` | Pending — current main tests retained |
| `tests/scanner-bridge/bridge.spec.ts` | Pending — current main tests retained |

## Required safe release order

Do not merge a DB-dependent application ahead of its contract while Git-triggered production deployment is enabled.

1. Prepare and validate a compatible code/database split. A front-only upload/removal/Ricoh promotion may use the existing production contract if it preserves current capacity/tombstones and removes unconditional dependencies on absent optional fields. Keep duplex/retention schema changes separate until their own upgrade is reviewed. This is a proposed next implementation, not an accepted compatibility result.
2. If the selected application still requires database additions, design/test a new additive forward migration against the actual production baseline, including current-capacity interactions and dynamic-SQL validation. Establish inventory/position/ledger/allocation/workspace/POS baselines and the multi-position non-duplication invariant. Do not assume a staging-shaped candidate applies.
3. Before any production mutation, verify a fresh recoverable production backup/PITR point and recovery procedure, then obtain the owner's explicit final migration approval. Neither backup availability nor the full production data baseline has been established in this task.
4. Only after authorized database application and invariant verification may compatible application code be merged, acknowledging that merge automatically deploys. Alternatively, an explicitly owner-approved deployment interlock could separate merge from deployment; none is configured or authorized by this report.
5. Complete browser and physical acceptance and verify live results; maintain immutable inventory history.

## Validation and completion status

- Clean branch creation / starting SHA: verified.
- Vercel automatic main production deployment: verified through settings and deployment source.
- Feature-source vs production scan contract: incompatible as written.
- Reviewed migration hash: verified unchanged; migration rejected as a production upgrade.
- Generated snapshot SQL parse: **FAIL**, confirmed offline.
- Full root/mobile/scanner/Windows/upload/removal/POS/DB/build/security suite on a reconciled branch: **NOT RUN** — no reconciled code exists; stop gate reached first. Earlier branch results were not reused.
- Final promotion SHA / commits introduced: no promotion commit; HEAD still equals starting main.
- Runtime files changed: none. This report is the only new file.
- Physical Ricoh single/10-card, orientation and recovery acceptance: still pending; earlier discovery does not count as scanning acceptance.
- PR/push/merge/deployment: none.
- Production/staging data/schema/settings mutation: none; no Docker or staging recovery work.

Stop for owner review. Do not report READY FOR PR or push a nominally complete promotion from this state.
