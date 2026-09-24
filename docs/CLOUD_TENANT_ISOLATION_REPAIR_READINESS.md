# Cloud tenant isolation repair readiness

Status: **Review/rehearsal only — production repair NOT applied.**

Branch: `codex/cloud-tenant-isolation-repair`. Evidence date: 2026-09-24 UTC.
Final verdict is recorded below after validation. This document supersedes the
audit's normalization-only recommendation: both migrations and the application
scope changes form one release. Do not deploy normalization by itself.

## Seven defects and their corrections

| # | Failing operation and current path | Why it succeeded before | Required predicate and correction |
|---|---|---|---|
| 1 | Inventory list/detail, owner with A active reads B through `inventory_items` | Permissive owner policy required only `user_id = auth.uid()`; shared list query had no workspace filter | Existing owner rights AND validated active membership in row workspace. Restrictive inventory RLS plus workspace-filtered shared query |
| 2 | Same owner switches to B and still reads A | Neither owner RLS nor owner-only list query changes with active preference | Same predicate; switching DB preference changes visibility in both directions; web pagination replaces the previous workspace's page set |
| 3 | Inventory asking-price update using an inactive-workspace item ID | Owner UPDATE policy and collector guard recognized owner, not active workspace | Restrictive UPDATE USING/WITH CHECK and inventory BEFORE mutation trigger; no override or broader pricing grant |
| 4 | `remove_inventory_lot_quantity` for another active scope | SECURITY DEFINER bypassed RLS; owner check was insufficient | Private item guard at RPC entry, before idempotency replay; shared inventory trigger also protects authoritative writes. Existing synchronization and ledger logic retained |
| 5 | `searchOwnedInventory` / shared `ownedInventoryQuery`, including exact IDs/SKUs | Same owner + positive quantity was the whole query scope | Database `current_inventory_workspace()` plus `.eq(workspace_id, ...)`, backed by restrictive RLS. Bounded provenance and distinct positions retained |
| 6 | Workspace member selects A after switching to their other workspace | Membership SELECT policy checked membership in A without active preference | Restrictive active-workspace boundary intersects the existing member policy; same-workspace member reads remain permitted, collector writes remain denied |
| 7 | Direct read of populated A `inventory_label_identities` with B active | Existing owner/member label policy did not uniformly require active scope | Restrictive label/alias/template/job/review/audit policies, parent guards, and active predicate at `pos_private.authorize_labels`; private POS authorization gets the same predicate |

The common predicate is `public.can_current_user_access_workspace(uuid)`.
It requires a JWT user, non-NULL target, database active preference equal to the
target, current membership, an existing workspace, a non-banned Auth user, and
canonical ownership when the membership claims owner. It is a narrowing check,
not an operation grant. Existing collector ownership, subscription, employee,
site-delegation and operation-specific rules still apply.

Both public helpers use SECURITY DEFINER with empty explicit search paths and
qualified relations. PUBLIC/anonymous execution is revoked; authenticated has
only the two scope-helper grants. New private trigger/item helpers have no
browser/service-role EXECUTE grants. No user-editable JWT metadata is trusted.

## Ordered migration set

1. `20260924005111_chaos_legacy_workspace_normalization.sql`
2. `20260924013600_cloud_active_workspace_authority.sql`

No historical migration is edited or replayed. First migration changes only 22
evidence-backed legacy `chaos_sort_batches.workspace_id` values. It locks the
relevant evidence, restricts its temporary immutable-batch exception to the exact
trusted migration context and metadata-only assignments, restores the original
guard definition, and verifies preservation before commit. Missing or conflicting
evidence aborts atomically. No persistent migration bypass remains.

Second migration performs no existing-row DML. It:

- Makes inventory and batch workspace mandatory.
- Adds restrictive `active_workspace_boundary` policies to inventory, positions,
  events, batches, albums, label identities, aliases, templates, jobs, pricing
  reviews and label migration audit.
- Resolves historical event scope through its inventory parent when the event's
  workspace is NULL; it does not rewrite acquisition/event history.
- Adds the inventory active-workspace trigger, including SECURITY DEFINER writes.
- Guards collector apply/remove/move entry points before replay lookup.
- Narrows private POS and label authorizers using the same predicate.
- Changes authoritative inventory workspace resolution to the validated active
  workspace, retaining canonical owner/manager/location/batch checks.
- Validates capture-to-album ownership/scope and label/review/job inventory,
  position, identity and template parents even inside trusted RPCs.

The dynamic function edits use the installed reviewed definitions and stop when
expected signatures/markers differ. Final preflight must compare definitions
with the rehearsed baseline; this is not a generic repair for arbitrary schemas.

## Application changes and boundaries

Web Inventory and global search share the same database-validated workspace
resolver and owner/active-quantity primitive. Exact-ID/SKU filters cannot bypass
RLS. Related provenance queries inherit that same RLS boundary. Distinct positions
are preserved. Inactive quantity remains excluded.

Mobile uses the same resolver and explicit workspace filter. Its user-only
collection snapshot fallback was removed: a failed scope/data request returns
an unavailable result, not old business records from a different workspace.
Existing on-device cache bytes are not read or cleared by this repair.

Owner-level locations remain owner-level reference records; this change does not
invent workspace ownership for shared locations. Legacy account-scoped sessions,
orders and reference catalogs are not converted to a new tenancy model here.
The deliberately public, opt-in QR product view remains separate from protected
operational barcode/label APIs; no public QR grant is broadened by this repair.

Authenticated collector operations require active scope even when invoked through
SECURITY DEFINER. Null-actor direct inventory writes now fail closed. This release
does not add a general maintenance/service bypass. Current authoritative Chaos
commit and owner POS sale/return passed under their real actor contexts. Any
future unattended inventory writer must have its own reviewed authorization
contract; it must not bypass this guard by setting browser-controlled flags.

## Rehearsal and data preservation

Target: disconnected disposable Supabase PostgreSQL 17.6.1.167 container, never
production or staging. Fresh clone of the recovered production-shaped database,
with the already-existing production cloud draft copied read-only into the
isolated baseline before testing. That draft is CS-000023, not a fabricated
historical batch. Production currently contains 22 legacy batches plus that draft.

| Historical invariant | Before | After both migrations, before synthetic fixtures |
|---|---:|---:|
| Inventory rows | 1,515 | 1,515 |
| Inventory units | 1,778 | 1,778 |
| Inventory events | 1,563 | 1,563 |
| NULL inventory workspace | 0 | 0 |
| Legacy NULL batch workspace | 22 | 0 |
| Historical legacy batch IDs | CS-000001–CS-000022 | Identical |
| Existing cloud draft | CS-000023 | Identical |

Whole-row fingerprints verify inventory, events and positions unchanged, and all
non-workspace batch fields unchanged. Original immutable guard is restored exactly.
No historical batches 24–29 are inferred or created. Synthetic test users, batches,
inventory and cash activity exist only in disposable databases; their counts are
not substituted for production preservation evidence.

The last read-only production recheck still returned 1,515 / 1,778 / 1,563,
zero unscoped inventory, 22 unnormalized legacy batches, zero POS-enabled
workspaces and zero Square connections. Production remains unrepaired by design.

## Authorization matrix

ALLOW means the established operation succeeds; DENY includes RLS not-found/zero
rows or the established authorization error. Tests use nonempty foreign targets.

| Actor relative to target | Inventory read | Owner inventory search | Exact POS barcode | Price | Collector removal | Label targets | Chaos history | Private album read/upload |
|---|---|---|---|---|---|---|---|---|
| Owner, target active | ALLOW | ALLOW | ALLOW in isolated enabled fixture | ALLOW | ALLOW | ALLOW | ALLOW | ALLOW |
| Ordinary member, target active | ALLOW under existing member policy | DENY other owner's collection | DENY without POS permission | DENY | DENY | DENY owner-only targets | DENY owner's history | DENY |
| Delegated employee, target active | Existing member policy | Own collection only; delegated POS search ALLOW | ALLOW with site permission | DENY | DENY | No new right | No new right | DENY owner's scans |
| Same owner/member, another workspace active | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| Employee delegated in B, A active | DENY B | DENY B | DENY B | DENY | DENY | DENY | DENY | DENY |
| Unrelated user | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |
| Anonymous | DENY | DENY | DENY | DENY | DENY | DENY | DENY | DENY |

All seven originally failing assertions change from unauthorized success to
DENY/not-found. Switching the same owner to B permits B reads, price updates and
removal again. Delegation does not become collection deletion/pricing authority.
Owned scan upload uses a genuinely reserved capture path; denial probes also
target valid reserved paths. Overwrite remains denied.

## Validation evidence

- Fresh complete migration/preservation/tenancy run: **41/41 PASS**.
- Original seven-defect follow-up and valid reserved upload tests: **14/14 PASS**.
- Expanded operation/delegation matrix: **58/58 PASS**, including a known exact
  barcode supplied independently of the staff member's restricted label-table reads.
- Real isolated PostgREST API: **12/12 PASS**. Owner reads active rows, cannot read
  or PATCH foreign rows, receives 403 on foreign removal, and is denied foreign
  label RPCs in both active-workspace directions. Anonymous reads denied; complete
  inventory fingerprint preserved. Temporary REST container removed afterward.
- Automated structural integrity gate: **11/11 PASS**.
- Actual shared TypeScript search service against recovery SQL/RLS: PASS;
  `scavengers` returns two Vastlands positions and Dreadwing quantity 5, three
  distinct positions total; no zero-quantity Scavenger's Talent.
- Deep Chaos DB workflow: PASS; 42 concurrent reservations, exactly 100 accepted,
  #101 blocked, replay protection, commit, tracked removal, sale/return history,
  immutable closed batch, label-before-next gate, delegated denial, history
  pagination at 100/1,000/10,000 rows. No production cash operation occurred.
- Root suite: **1,004 PASS**, zero failed/skipped.
- Mobile suite: **580 PASS**, zero failed/skipped; mobile TypeScript PASS.
- Root TypeScript and production build: PASS.
- ESLint: zero errors; **548 warnings**, same as pre-change baseline. Mobile lint:
  zero errors, three pre-existing warnings. These are not represented as zero-warning runs.
- Secret audit: PASS for known fixture privileged keys/passwords and secret-key
  patterns across changed/untracked nonignored files and built browser assets.
  Recovery exports and raw test evidence remain ignored/outside Git. This is not
  a claim to have exhaustively identified every possible unknown secret.
- `git diff --check`: PASS.

Security advisor: official Supabase CLI **2.117.0**, release archive SHA-256
verified against its published checksums. Executed `db advisors --type security`
against the repaired disposable DB, using a transient Ubuntu runtime sharing the
disconnected DB network namespace. Result: **no issues found**, `results: []`.
No external integrations or production secrets were configured. Hosted project
settings (for example Auth password protection) are outside a local DB advisor's
scope. The earlier failed CLI transport attempts are not counted as PASS.

## Repeatable gates and production preflight after approval

```text
node tests/cloud-tenant-audit-db.mjs --repair
node tests/cloud-tenant-active-workspace-db.mjs --repair
node tests/cloud-tenant-repair-matrix.mjs
node tests/cloud-tenant-repair-api.mjs
node tests/cloud-tenant-integrity-check.mjs
node --experimental-strip-types tests/global-search-recovery.mjs
node tests/chaos-cloud-authority-db.mjs --tenant-repair
npm run typecheck
npm run lint
npm test
npm run build
```

DB runners refuse a network-connected recovery container and do not accept
production URLs. The integrity runner fails on any NULL required workspace,
orphan workspace/position, cross-workspace position, owner membership mismatch,
or album/capture-parent mismatch reported by `tests/cloud-tenant-integrity.sql`.
Ordinary changing business totals are informational outside a release preflight.

Before any separately approved production execution: verify fresh recoverable
backup, exact project, migration ledger, function definitions, and reviewed row
fingerprints. Run the read-only integrity SQL; exactly the 22 known legacy NULL
batches may be findings before step 1, with zero findings afterward. Confirm
inventory 1,515 / units 1,778 / events 1,563 or stop for review of changed baseline.
Confirm all POS workspaces disabled and Square unconfigured. Both migrations use
a five-second lock timeout; normalization takes an exclusive batch lock and share
locks on evidence tables, and NOT NULL/policy/trigger DDL takes table locks. Use
an idle maintenance interval; do not run during intake/commit or inventory writes.
Rehearsal establishes functionality, not a production lock-duration guarantee.

Apply both migrations as one controlled release before deploying the dependent
client resolver. Between steps, do not reopen affected workflows. If step 2 fails,
leave traffic gated and stop: normalization alone is not the security repair.
After schema verification, deploy matching web/mobile code; verify normal and
multi-workspace browser behavior. No app deployment is authorized by this report.

Stop for unexpected assignments, row/quantity/event change, foreign parent,
authorization/grant/RLS change, function drift, lock timeout or failed gate.
Do not roll back by removing restrictive security policies or resurrecting stale
client caches. Retain evidence, restrict affected operations, and use a reviewed
forward correction or verified recovery procedure. Never delete inventory or
financial history to make a check pass.

## Final decision

**SAFE TO APPLY** as the complete reviewed two-migration repair plus matching
application scope changes, subject to the fresh production preflight/recovery
and controlled release order above. This verdict is based on the repaired
Supabase-compatible DB, real isolated REST probes and application regressions;
it is not a claim of already-completed production browser acceptance.

All seven original active-workspace failures are closed in rehearsal. Production
application still requires separate owner approval. Do not apply the legacy
normalization alone.

POS remains disabled. Production Square remains disabled. No hardware certification
or scanner gate was changed. No commits were pushed, merged or deployed.
