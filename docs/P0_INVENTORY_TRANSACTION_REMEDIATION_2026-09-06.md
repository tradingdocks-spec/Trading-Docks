# P0 inventory transaction remediation — September 6, 2026

**Implementation: fixed and locally verified. Production launch blockers: both OPEN pending approved migration application and staging/deployed verification. Trading Docks remains NO-GO.**

Branch: `codex/p0-inventory-transactions`, based on `163d613ef4b6543eb1b3651e7fa6fc06d131dcd1` plus the existing working tree. This work is limited to LC-01/LC-02 from the [launch certification](PRODUCTION_LAUNCH_CERTIFICATION_2026-09-06.md). No deployment, Supabase schema application, environment configuration, or secret change occurred. Pre-existing mobile, package, and audit changes remain in the checkout; no claim is made that those changes belong to this remediation.

## P0-1: fulfillment

### Root cause and complete active path

The original `/api/orders/fulfillment` handler performed separate reads and writes. It ignored errors from inventory deduction, movement insertion, and line deduction markers, then checked only the final order update. It could return HTTP 200/shipped after deduction failed; an interruption or later shortage could leave prior writes committed.

Tracing the user action found an additional entry point into the same defect: `/dashboard/orders` renders `UniversalOrdersCenter`; its **Mark shipped / Mark delivered** buttons call `/api/orders/bulk`. That endpoint previously updated the normalized order status directly, without any inventory deduction. Fixing only the audited fulfillment endpoint would not fix the active product workflow.

Before:

`UI action → independent inventory / line / ledger writes → order status write → HTTP success → local success state`

The active bulk variation was `UI action → order status only → local success state`.

After:

`UI action → orders.manage authorization → server-only commit_order_fulfillment RPC → one PostgreSQL transaction → acknowledged committed result → UI updates from that result`

Both entry points now use the same boundary. No server action intervenes in this path, and the operation does not call an external shipping carrier.

### Transaction and retry behavior

- The transaction serializes against the existing per-user inventory lock, then locks selected orders and lines. Inventory rows are locked before deduction.
- Ownership is checked for every requested order. A mixed own/foreign order selection fails as a whole.
- Stock quantity, its JSON projection/value, deterministic ledger events, line deduction markers, order status/timestamps, and affected location totals commit together. Any raised error rolls back the entire RPC, including earlier orders in a bulk selection.
- Ledger event IDs derive from the order-line ID. Completed retries verify the existing deduction evidence and do not deduct or insert another event. Delivery transitions preserve the prior deduction. A repeated ship request cannot move a completed order backwards.
- Historical markers without the new corroborating ledger evidence, or previously shipped records without a trustworthy deduction, fail explicitly for reconciliation. The implementation does not guess whether legacy stock was already deducted.
- `mark_picked` sets the picked quantity instead of toggling it, so duplicate requests do not undo picking. Matching does not claim a match when multiple inventory candidates are ambiguous.
- The existing refund status action preserves the fulfillment ledger; it does not silently restock items. Reopening fulfilled inventory still requires reconciliation.
- API errors remain non-2xx. Missing RPC configuration returns 503 with no fallback to the old writes. A missing service-role configuration also fails instead of proceeding.
- The UI prevents overlapping submissions, catches transport/API failures, leaves the previous order state and selection intact, shows an alert, and releases its busy state. It changes local status only from an acknowledged server result, not from the requested status.

## P0-2: CSV import

### Root cause and complete active path

`CsvConversionEngine` is the active `/dashboard/tools/csv-converter` component. Parsing, mapping, finish splitting, and preview produce the reviewed rows. Previously, Save cards loaded an inventory snapshot, aliased its locations array, pushed/changed the location in that same array, then compared it against itself in `persistInventorySnapshotDiff`. The diff omitted the new/changed location. Separate 500-row writes were not an atomic import, and random row IDs made partial retries unsafe. There was no durable inventory-import batch receipt in this path.

Before:

`parse/map/preview → mutate original snapshot → diff misses location → separate item/movement chunks → success notice or partial failure`

After:

`parse/map/preview → POST /api/collector-workspace/import → collection.write authorization → normalize/hash reviewed contents → server-only commit_csv_inventory_import RPC → location + items + ledger + commit receipt in one transaction → authoritative success/replay result`

The snapshot-diff helper remains unchanged for other callers. This CSV path no longer uses it or browser-generated inventory IDs.

### Transaction and retry behavior

- An existing location is resolved under the authenticated owner, using its normalized name. A new location is inserted before inventory references it. Ambiguous duplicate location names fail explicitly.
- Imported item columns and JSON both contain the authoritative location ID. The existing Inventory and location-filter view model resolves these rows; movements and item JSON also carry the import batch ID.
- The commit receipt in `inventory_import_commits` is written in the same transaction. Failure at location creation, any inventory row, any movement, location totals, or receipt insertion rolls everything back. A failed attempt leaves neither a new location nor a partial batch.
- A SHA-256 key derives from normalized reviewed rows plus destination/listing content. Row order and destination capitalization do not create a different commit. Duplicate source rows within one file remain distinct rows; the import is not accidentally collapsed.
- Repeating the same normalized import after a failed response, refresh, or duplicate upload returns its stored receipt. Stable inventory/movement IDs provide an additional uniqueness boundary. No second inventory set, location, or batch is inserted.
- Existing database inventory ownership/membership/Free-plan quantity guards still run through the established authorized-user context. The proposal checks that the prerequisite security foundation exists.
- The endpoint accepts 1–5,000 rows and rejects invalid values before mutation; the existing proxy request-size limit also applies. It does not split one logical commit into independent chunks.
- UI success uses the committed unit count and location name. A replay is labeled already saved. Failures use an alert and preserve the input for retry; transport failure is labeled an unconfirmed outcome rather than a false assertion that nothing committed.

There is no new Batch screen in this change. The receipt is the durable batch identity, and the existing Inventory/location views continue to use their current data model. A rendered authenticated browser walkthrough of those views remains outstanding.

## Exact changed files for this task

| File | Change |
| --- | --- |
| [fulfillment route](../src/app/api/orders/fulfillment/route.ts) | Replace separate fulfillment writes with the atomic RPC; validate request; propagate errors. |
| [bulk order route](../src/app/api/orders/bulk/route.ts) | Route the active Orders status actions through the same transaction. |
| [CSV import route](../src/app/api/collector-workspace/import/route.ts) | New authorized endpoint for the existing Save cards action. |
| [UniversalOrdersCenter](../src/components/dashboard/orders/UniversalOrdersCenter.tsx) | Confirmed-result UI updates, retained failure state, alert, submission guard, and transport handling. |
| [CsvConversionEngine](../src/components/dashboard/tools/CsvConversionEngine.tsx) | Replace the aliased snapshot save with the atomic import request and receipt/error handling. |
| [inventory-commit.ts](../src/lib/inventory-commit.ts) | RPC acknowledgement and error boundary, including fail-closed missing migration handling. |
| [inventory-commit-client.ts](../src/lib/inventory-commit-client.ts) | Shared web request helper rejects errors, malformed responses, and unknown outcomes. |
| [inventory-import.ts](../src/lib/csv-conversion/inventory-import.ts) | Server validation, normalized payload, and durable content identity. |
| [migration proposal](../supabase/migrations/202609060001_inventory_commit_boundaries_proposal.sql) | Two server-only transaction functions and the import receipt table. Unapplied to Supabase. |
| [inventory-transactions.test.ts](../tests/inventory-transactions.test.ts) | 28 actual SQL/route regression tests. |
| [inventory-commit-client.test.ts](../tests/inventory-commit-client.test.ts) | Six client/RPC acknowledgement and error tests. |
| [inventory-transaction-db.mjs](../tests/helpers/inventory-transaction-db.mjs) | Isolated PostgreSQL fixture applying real inventory/order/security migrations and the proposal; real-route loader. |
| [p0-reproductions.mjs](../tests/helpers/p0-reproductions.mjs) | Executable reproductions of the fixed paths against actual SQL. |
| [package.json](../package.json), [package-lock.json](../package-lock.json) | Add only `@electric-sql/pglite` 0.5.8 as a development test dependency; preserve prior dependency changes. |
| [fulfillment reproduction](../.launch-audit/reproduce-fulfillment.mjs), [CSV reproduction](../.launch-audit/reproduce-csv-location.mjs) | Replace assertions expecting the original bug with stronger fixed-path database assertions. Original script contents are archived in `.launch-audit/p0/original-reproduce-*.mjs`. |
| This report and [certification cross-reference](PRODUCTION_LAUNCH_CERTIFICATION_2026-09-06.md) | Document implementation, evidence, and remaining open production gates. |

Additional generated evidence lives in [.launch-audit/p0](../.launch-audit/p0/): before/final logs, archived original reproduction scripts, and the full remaining lint-error inventory. Existing mobile and earlier audit edits are not remediation changes. The generated `tsconfig.tsbuildinfo` delta was restored; no generated build output is part of the proposed change.

## Regression coverage and validation

| Required check | Result |
| --- | --- |
| Original reproductions before modification | Both reproduced their original defects. Original script contents preserved. |
| Final fulfillment reproduction | PASS: `reproduced: false`; injected inventory failure produces 409 with stock, order, marker, and ledger unchanged. |
| Final CSV reproduction | PASS: `reproduced: false`; location exists, item columns/JSON reference it, retry inserts no duplicates. |
| Successful deduction + fulfillment | PASS, actual route and SQL. |
| Failed deduction / ledger / line / final order / location-total write | PASS, transaction rollback and safe retry. |
| Duplicate / repeated / queued duplicate fulfillment | PASS, one deduction and ledger event; delivery/retry preserves completion. |
| Later-order shortage in bulk fulfillment | PASS, earlier deductions roll back; corrected stock allows one successful retry. |
| Existing/new location imports | PASS, reused/created under the correct owner and totals recomputed. |
| Location / inventory / movement / receipt import failure | PASS, no new orphan location, partial inventory, movement, or batch receipt. |
| Row 501 import failure | PASS, every row/location rolls back; retry then duplicate replay produces exactly 501 rows and movements. |
| Inventory/location visibility and batch identity | PASS at the actual shared view-model/data level. Authenticated rendered views are not certified. |
| Membership cap / owner scoping / direct authenticated RPC denial | PASS in the isolated database and route tests. Not a full deployed tenant-isolation certification. |
| Migration replay | PASS, reapplying proposal preserves committed receipts and deduplication. |
| Focused regression tests | 34 passed, included in full web suite; zero new skips. |
| Complete web suite | **583 passed**, zero failed/skipped. Existing 549 tests preserved. |
| Complete mobile suite | **620 passed**, zero failed/skipped. Run because the database behavior affects shared inventory; mobile source was not edited. |
| Typecheck | PASS, `npm run typecheck`, exit 0. |
| Focused lint for changed runtime/tests | PASS, zero errors/warnings. |
| Root lint | **FAIL: 21 errors, 471 warnings**, same as the pre-change baseline. No lint rules were suppressed or weakened. |
| Production build | PASS, `npm run build`, exit 0, Next.js 16.2.12. |
| Authenticated browser tests | **NOT RUN:** all configured QA credential pairs absent. Not counted as passing or silently skipped for a green result. |
| `git diff --check` | PASS. |

The SQL tests use [PGlite's in-memory PostgreSQL runtime](https://pglite.dev/docs/), not a JavaScript model of transaction behavior. They apply the real inventory/order tables and security triggers plus the proposed migration, then inject SQL trigger failures. Identity/provider prerequisites are minimal fixtures; this is not a full replay of every repository migration. [PGlite has a single database connection](https://pglite.dev/docs/), so queued duplicate tests do **not** prove production multi-connection locking behavior. Real Supabase/PostgREST concurrency tests remain required.

No existing tests were deleted, suppressed, or weakened. The audit scripts originally asserted that defects existed; their replacements assert the requested safety outcomes and use real SQL. Their before versions remain available for comparison.

### All remaining root lint errors

The full machine-readable list is [remaining-lint-errors.json](../.launch-audit/p0/remaining-lint-errors.json); raw output is [final-root-lint.log](../.launch-audit/p0/final-root-lint.log).

| File | Locations | Errors |
| --- | --- | --- |
| `mobile/components/scanner/automatic-scanner-screen.tsx` | 2553:71, 2554:75, 2555:76, 2556:75, 2557:75, 2558:61 (two diagnostics), 2559:59 (two), 2559:170, 2559:226, 2560:62 (two), 2560:177, 2560:235, 2561:70, 2562:77 | 17 ref-access-during-render errors. |
| `mobile/components/scanner/prebuilt-scanner-bakeoff-screen.native.tsx` | 144:31 | Forbidden `require()` import. |
| Same file | 419:39 | Existing memoization could not be preserved. |
| Same file | 1043:19 | Prefer const assertion over literal type annotation. |
| `mobile/services/mobile-deck-vault.ts` | 226:3 | Assignment to the reserved `module` variable under the Next.js lint rule. |

These remain outside the authorized two-defect scope. The development dependency install also reported two dependency advisories (one moderate, one high); no unrelated audit-fix dependency updates were applied. This is not a fresh production-only dependency-security certification.

## Required migration and closure conditions

Status: **Requires Production Configuration**. The proposed `202609060001_inventory_commit_boundaries_proposal.sql` is necessary for both fixes. It adds `inventory_import_commits` and creates `commit_order_fulfillment(uuid,uuid[],text,jsonb)` and `commit_csv_inventory_import(uuid,text,jsonb)`. The receipt table is RLS-enabled; only service-role table access/function execution is granted. Browser roles cannot invoke either RPC directly. Existing ownership/membership triggers remain enabled.

Application of this proposal to Supabase requires explicit approval under AGENTS.md. It was executed only in isolated local test databases. Do not deploy the application against a database without these functions: writes fail closed and the workflows remain unavailable.

Before either production blocker can be marked CLOSED:

1. Review and explicitly approve the migration; replay it against the actual staging schema with the current security migrations and grants.
2. Execute the API tests through real authenticated Supabase/PostgREST requests, including simultaneous separate connections targeting the same stock, order, or import. Verify one receipt/ledger result and no lost quantities.
3. Reconcile pre-existing shipped/partially deducted orders. The new boundary deliberately refuses ambiguous historical state rather than double deducting or claiming unsupported success.
4. Run authenticated Orders and CSV browser flows, including failed writes and lost responses; confirm Inventory and intended Location views after refresh. Record the actual release commit, environment, and evidence.
5. Apply the approved migration through the normal release process and verify the deployed result separately. No deployment or production application is part of this task.

Remaining limitations: identical normalized imports to the same destination replay an existing receipt, so they cannot represent a second intentional identical acquisition through this action. Editing the normalized contents or destination creates a different import identity; recovery must retry the unchanged reviewed input. Imports are bounded to 5,000 rows/the existing request-size cap. Legacy ambiguous deductions need explicit reconciliation, not an automatic rollback that guesses what already happened. Provider-reported imported shipment statuses and external shipping operations were not redesigned by this change.

**Final gate decision: LC-01 OPEN; LC-02 OPEN for production, with local fixes and regression evidence complete.** Authentication, full tenant isolation, billing, production verification, root lint, and all unrelated P1/P2 certification gates remain open until separately certified.
