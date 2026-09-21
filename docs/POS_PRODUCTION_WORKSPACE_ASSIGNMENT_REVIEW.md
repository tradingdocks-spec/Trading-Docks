# Production workspace assignment review — September 21, 2026

**SAFE TO ASSIGN + CONTINUE — for the reviewed legacy cohort, subject to owner approval before production execution.**

Production was inspected only through read-only transactions. No production rows, migrations, settings, POS flags or Square credentials were changed. Only sanitized counts and examples are committed; row-level IDs, provenance and relationship evidence remain in ignored local fixtures.

## Classification

| Category / rule | Positive quantity | Zero quantity | Total |
| --- | ---: | ---: | ---: |
| DETERMINISTIC: explicit inventory-event workspace | 2 | 17 | 19 |
| DETERMINISTIC: sole eligible owned workspace | 1,458 | 12 | 1,470 |
| AMBIGUOUS | 0 | 0 | 0 |
| UNRESOLVED | 0 | 0 | 0 |
| INTENTIONALLY UNSCOPED | 0 | 0 | 0 |
| **Total** | **1,460** | **29** | **1,489** |

All affected rows belong to one canonical owner. That owner has exactly one workspace membership, with role `owner`, and owns exactly one workspace. The owner is not banned. The workspace model has no separate active/archive flag; eligibility therefore requires its existence, matching canonical owner, explicit owner membership and active Auth account. A manager/member/delegation relationship never substitutes for ownership.

The 19 explicit inventory events all identify that same legitimate workspace. There are no conflicting workspace contexts. No location, batch, session or marketplace relationship supplied an additional explicit workspace for this cohort; those relationships corroborate ownership rather than inventing scope. The remaining 1,470 rows satisfy the sole-owned-workspace rule only after all stronger evidence and conflicting relationships are checked. The query does not choose the first of several workspaces: more than one membership blocks the sole-workspace rule, even if only one workspace is owned.

## Provenance and tenant evidence

- 1,488 rows identify Chaos Sort as their source and have owned positions/batches. Their source batch IDs resolve; batches and sessions have the same canonical owner. Those batches have NULL workspace IDs; sessions have no workspace column.
- One zero-quantity, removed legacy row has no recorded source, batch/position or location. Its original producer cannot be proven. Its workspace association is nevertheless deterministic through the sole eligible owned workspace. Unknown import provenance is not claimed as evidence.
- All 1,488 non-null inventory locations resolve to the same owner. The location schema stores owner IDs, not workspace IDs. Its JSON metadata has no workspace/store authority, so names, descriptions and hierarchy are not used to infer scope.
- The affected rows have 1,519 inventory events; 19 carry explicit workspace context. Event metadata keys contain batch/session and operation/removal details, not another workspace/store identifier. No foreign-owner event or position relationship was found for these rows.
- **Zero** affected marketplace allocations, selling candidates, listing mappings, order items or canonical label identities exist. No allocation or listing is being transferred across a workspace boundary. The migration refuses newly appearing marketplace relationships until reviewed.
- All current owner memberships were enumerated; none were discarded because of role or display name. No fuzzy matching, employee permission, active-browser workspace preference or manager status is used as ownership evidence.

The nullable legacy schema permits unscoped inventory in general. That alone is not evidence that these particular rows were deliberately personal/unscoped. No explicit keep-unscoped context was found in their metadata. This rule is restricted to the reviewed cohort and is not a policy to assign every user's personal inventory automatically.

Sanitized examples: a positive Chaos row without explicit scope uses the sole eligible owned workspace; a historical zero-quantity row with a workspace-bearing event uses that event after validating ownership; the removed row with no location uses the sole eligible owned workspace. Actual IDs and customer/product details are excluded here.

## Root cause and zero-quantity treatment

The production Chaos commit function inserts inventory without `workspace_id`; it also creates batches without workspace scope. That explains the 1,488 Chaos-origin rows. The remaining row's producer is not established. Missing schema defaults do not justify assigning scope from a session preference.

All 29 zero-quantity records can receive the same deterministic association without reactivation. Eleven Chaos rows and the single unknown-source row retain `removedAt`; another 17 historical Chaos rows have no removal marker. Quantities, markers, timestamps, positions and events remain untouched. No row is deleted, archived, superseded or reinserted by this migration.

**Recurring-write follow-up:** after assignment, a rolled-back Chaos commit succeeds but still creates unscoped inventory under the preserved production writer. This migration fixes existing rows only. A separate writer-compatibility review is needed before claiming durable Label Studio production readiness. Do not broaden workspace filters or repeatedly rerun this snapshot-limited backfill to mask that issue.

## Proposed forward migration

`20260921201424_inventory_workspace_assignment.sql`

For the Label Studio rehearsal, the exact sequence was:

1. `20260921195747_label_production_compatibility.sql`
2. `20260921195836_chaos_and_pos_authority_compatibility.sql`
3. `20260921201424_inventory_workspace_assignment.sql`

No historical migration was replayed. The assignment itself requires no label/POS schema installation; the first two files provide the separately reviewed application compatibility prerequisites. This is not the broader 12-file POS installation plan, whose overlap with standalone label objects still requires a reviewed continuation plan.

The assignment migration:

- Reclassifies current NULL-workspace rows inside the transaction rather than trusting a stale external manifest.
- Requires the reviewed 1,489-row cohort, 1,460 positive rows and one trusted platform-owner identity. Changed cohort counts stop execution; a fully assigned environment is a no-op.
- Requires target existence, active legitimate owner and owner membership; checks explicit event/batch/identity/marketplace context and location/batch/session ownership.
- Aborts the **entire transaction** on any ambiguous/unresolved row, including zero-quantity cases, or any newly appearing marketplace relationship. No partial guesses or alternate workspace selection occur.
- Locks inventory against concurrent writes and locks evidence tables against changes through classification, update and verification.
- Updates only `workspace_id` where it is still NULL. A temporary exact-old-row/exact-new-row permit permits only this trusted backend/transaction to pass the collector trigger. It does not impersonate a user, disable triggers, change grants, or install a public backfill helper. The original function definition is restored inside the same atomic statement; failures roll back both function and data changes.
- Verifies full row JSON equality except the intended workspace field, preserving even `updated_at`. It leaves no permit table or migration flag behind.

The added inference code is embedded in the forward migration and reused by the read-only classification/rehearsal tests. UUID context in either supported event-ledger representation is handled explicitly; malformed context aborts instead of being guessed.

## Disposable results and invariants

| Invariant | Before | After |
| --- | ---: | ---: |
| Inventory rows | 1,515 | 1,515 |
| Sum of quantities | 1,788 | 1,788 |
| Owner inventory rows | 1,514 | 1,514 |
| Unassigned reviewed rows | 1,489 | 0 |
| Inventory events | 1,550 | 1,550 |
| Marketplace allocations | 0 | 0 |

Full before/after snapshots prove unchanged owner IDs, game IDs, quantities, locations, batches, sessions, positions, inventory events and selling candidates/allocations. The only changed inventory field is `workspace_id` on the 1,489 deterministic rows. The 26 already-scoped inventory rows remain unchanged. Existing policies compare byte-for-byte; the collector guard is restored byte-for-byte. Ordinary unauthorized mutations still raise `TD_COLLECTOR_UNAUTHORIZED`.

Adversarial tests prove all-or-nothing refusal for a second workspace membership, foreign event scope and a banned owner. An authenticated API role cannot invoke the migration-only path. Re-execution after completion is a no-op.

The signed-in owner reads 1,514 correctly scoped inventory rows; the other tenant reads zero of them. Label Studio's actual component loads and receives the first 500 eligible targets (the existing RPC cap), and an exact-position canonical label is issued and resolved. A separate Store fixture still prepares a rendered label without browser errors. The test uses a loopback SQL adapter and actual component/renderer, not a hosted production deployment or physical printer.

An additional POS fixture rehearses the assignment before exact-position barcode search, proves foreign-workspace denial, then runs the full existing staff/delegation, owner, manager-denial, inventory, payment and register checks: **129 passed for each ledger variant**. These are disposable test workspaces; production remains POS-free/gated. The full production-shaped rehearsal contains the actual schema and sanitized relationships; the smaller POS fixture adds only omitted empty marketplace tables and the batch scope column to represent its required production prerequisites.

The post-assignment Chaos commit succeeds without `location_id` ambiguity and is rolled back after checking current behavior. No new production inventory or events were created by any acceptance probe.

Evidence: [sanitized rehearsal summary](production-workspace-assignment-rehearsal.json), [rehearsal tests](../tests/production-workspace-assignment.mjs). Repeat with `node tests/production-schema-rehearsal.mjs --compatibility --workspace-assignment` and `node tests/pos-db.mjs --compatibility --workspace-assignment` (also `--enum-ledger`). Captured row-level fixtures stay ignored.

The root suite passed 960 tests; syntax/diff checks and the scoped secret audit passed. Read-only privilege checks confirmed the trusted production migration role has the inventory update and Auth/role evidence-lock privileges required by the proposed migration. No production locks were taken to test that permission.

## Owner execution gate

**SAFE TO ASSIGN + CONTINUE** means this reviewed assignment is deterministic and preserves the tested boundaries. It does **not** authorize production execution, enablement or deployment, and does not resolve the recurring Chaos writer omission or future POS installation ordering.

Immediately before any separately approved execution, rerun the embedded classification read-only and compare all category/rule/count totals. Stop on new memberships, conflicts, marketplace relationships, counts or ownership drift. Use a transaction with bounded lock and statement timeouts during a quiet maintenance window; do not wait indefinitely for locks. The uncontended local assignment took approximately half a second; production lock contention is not modeled.

After assignment and before commit, compare inventory counts/quantities and a full-row snapshot excluding only workspace; verify changed rows exactly match the approved cohort and target; compare events, allocations, guard definition and policies; run read-only label queries under the correct identity. On failure, roll back. After a committed assignment, do not erase history or blanket-null workspaces: prefer a separately reviewed forward correction with exact original/new associations. No production operation is performed by this report.
