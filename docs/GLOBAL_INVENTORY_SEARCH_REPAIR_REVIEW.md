# Global inventory search repair review

2026-09-22 review; production promotion approved by owner on 2026-09-23.

Branch: `codex/global-inventory-search`. No production deployment, migration,
data mutation, feature-flag change, or Square configuration was performed.
The earlier inventory-removal execution report remains a separate local artifact.

## Exact cause and reproduction

Production global search for `scavengers` reproduced **Search data is unavailable**
and **Inventory could not be loaded. Your inventory results may be incomplete.**

Path: `GlobalSearch.tsx` → `searchWebInventory` in
`collector-workspace-client-data.ts` → `loadInventoryProvenance` → Supabase
PostgREST `GET /rest/v1/chaos_sort_inventory_positions`.
There is no Next API route, server action or search RPC on this path. Both this
path and the working Inventory/Collection loader use the authenticated browser
Supabase client with `auth.getUser()`, explicit owner filtering and existing RLS.

Global search removed the query filter before fetching up to 5,000 active items.
The hosted API returned its first 1,000 rows. It then placed every returned ID
in one `.in("item_id", itemIds)` provenance URL, before matching the search text.
Reconstructing that request from the actual production candidate IDs produced
a **58,266-byte URL**, **HTTP 400**, response body **`Bad Request`**. This was a
read-only public-client gateway reproduction; it did not impersonate the owner.
An authenticated hosted-staging reproduction with the original query also returned
**400 / Bad Request** for 1,000 IDs. The exception propagated by the reader is
**`Inventory provenance is unavailable: Bad Request`**. This is a transport failure,
not a missing column, SQLSTATE or failed ownership check.

The working Inventory page renders `CollectorWorkspace`, using
`loadWebCollectorCollectionPage`. It applies the search filter in the database and
loads one bounded page. It does not submit the entire library to this provenance
request. Production has all selected multi-TCG and provenance columns, including
`game_id`, `language`, and position/batch metadata.

Two further defects compounded the failure:

- Global candidate matching was stricter than the UI's fuzzy matching, so plural
  `scavengers` did not match singular Scavenger names even if transport succeeded.
- `Promise.allSettled` retained healthy deck results, but the JSX `loadError`
  branch hid every result behind the inventory error screen.

## Local fix

- Extracted `ownedInventoryQuery`: one column selection and active-owner predicate
  shared by Inventory/Collection and global search. It retains user, workspace,
  location, game and identity fields; no alternate index or service-role reader.
- Global search reuses Collection's database search expression for names, sets,
  collector numbers, SKU and metadata, with singular alternatives for plural
  queries. Existing location and batch discovery remain supported.
- Candidate paging is 250 rows, with a 100-item UI result limit. Filtering happens
  before that limit, so late-alphabet results beyond the old server cap are found.
- Provenance IN filters are chunked by encoded size; position results are paged,
  and batch joins use small chunks. An empty item list performs no provenance scan.
- Separate inventory records and position IDs remain separate. Grouped card-name
  results retain per-record navigation, batch and location links and quantities.
- Inventory failures render a scoped status panel alongside healthy results.
  Short/empty queries do not load the library; input is debounced and timers cleared.

No schema, RLS, grants, workspace assignments, inventory quantities or ledger
semantics change. Barcode/SKU lookup uses the existing inventory SKU field; this
does not introduce an independent barcode registry or POS lookup permission.

## Authorization and scope

The UI reader derives its owner ID from `auth.getUser()`, not from caller-controlled
request input. Like the working Collection, this is the user's owner collection,
not a switch to another workspace owner's inventory via POS delegation.

Existing hosted RLS includes an owner policy and `Workspace members view inventory
items` for SELECT. Therefore a member may already perform authorized workspace
reads even without POS write delegation. Tests preserve this distinction; they
do not mislabel those existing SELECT rights as an authorization defect or grant
new general inventory mutation rights. Cross-tenant and anonymous checks passed.
No policies or staff/delegation assignments were changed.

## Validation

- Baseline before runtime edits: TypeScript, ESLint, 960 tests and dependency audit
  passed.
- Local fixture regressions cover all three requested names, normal and Chaos
  origin, singular/partial name, set/collector/SKU, multiple batches/positions,
  quantity >1, zero exclusion, tenant isolation and source-failure isolation.
- Retained Supabase-compatible **production-shaped recovery** rehearsal runs the
  new reader through a read-only SQL adapter under the authenticated owner role.
  It returned **four items/four positions**: two Vastlands records (1 each),
  Dreadwing (5), and Scavenger's Talent (1). Counts were unchanged. The adapter is
  not represented as a hosted REST test.
- Separate **hosted staging REST/Auth** tests reproduced the legacy 400 and
  exercised the new reader over the existing 10,000+ item fixture. Broad name
  and location searches returned 100 items in approximately **0.5–1.1 seconds**
  on the final run. Cross-tenant, current-user member/delegated behavior and
  anonymous denial passed. That staging fixture has no named scavenger cards;
  named coverage comes from the local fixtures and restored production shape.
- `npm run check`: passed (TypeScript, ESLint zero errors,
  dependency audit zero vulnerabilities). Final full root suite: **966 passed**,
  including the additional batch regression. Changed-file lint also passed.
- `npm run build`: passed. An intermediate timer typing error was corrected
  before the successful final build.
- No production browser acceptance of the new code is claimed: it is not deployed.

Pre-promotion recheck (2026-09-23): hosted search/security tests passed again.
An isolated local copy of the production GlobalSearch component, with only its
data imports replaced by fixtures, intentionally rejected inventory reads. In
Everywhere search, `scavengers` still rendered **Dreadwing Scavenger, two copies,
Healthy deck fixture**, alongside the scoped inventory warning; no browser console
errors. Harness: `tests/global-search-fault-preview.mjs`. No production fault or
data mutation was used for this test. Deployment acceptance is recorded separately.

Reproduction commands:

```text
node --test --experimental-strip-types tests/global-inventory-search.test.ts tests/inventory-search-provenance.test.ts
node --experimental-strip-types tests/global-search-hosted.mjs
node --experimental-strip-types tests/global-search-recovery.mjs
npm run check
npm run build
```

Hosted and recovery tests require the existing private fixtures/recovery database;
no credentials, snapshots or recovery dumps are included in these changes.

## Current production observation and approval gate

Production Scavenger's Talent is now quantity **0** and must remain excluded from
active search. The retained earlier recovery snapshot has quantity 1, allowing
the requested three-name rehearsal without modifying production.
Current production observations: 1,515 inventory rows, 1,778 units, 1,563 events;
1,457 active owner rows; **0 POS-enabled workspaces**, **0 Square connections**,
**0 Square credentials**. These are observations, not mutations by this task.

Risk is limited to read/query and result presentation behavior. The shared
provenance reader also serves Card Workspace, which has regression coverage.
Broad batch/location queries may make more bounded reads; the existing timeout
continues to isolate an unavailable source. The 100-item display limit remains.

**Ready for owner review, not applied to production.** If approved, promote only
the search repair and tests through a focused PR, then verify the signed-in global
search and source error behavior after deployment. Rollback is application-only;
there is no database migration to undo. POS and production Square stay disabled.
