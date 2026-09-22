# Collection removal repair — awaiting production approval

Date: 2026-09-22. Branch: `codex/chaos-inventory-removal-fix`.

## Confirmed production root cause

Read-only Vercel logs for `POST /api/collector-workspace/bulk-remove` at
21:09:45 and 21:11:50 UTC report PostgreSQL `P0001: POS_STOCK_UNAVAILABLE`.
The UI's generic “Bulk removal failed” hides that database error.

The affected record is Weather Maker, TMT #182, NM/normal, in UC Bulk Boxes.
Its inventory item and tracked position share ID
`chaos-37534979799c46b38534a50e22083540-8037be6f7fd5422d`.
The inventory row has quantity **1**, but its sole tracked position has quantity
**2**. Both belong to the same owner and location. The item has its canonical
workspace assignment; the older batch and JSON workspace field are unscoped.
`game_id`, language and physical slot are unrecorded. None were inferred.

Diagnostic identifiers (not an export):

| Relationship | Identifier |
| --- | --- |
| Owner | `3ea45327-7984-4108-ada8-511748e73fd8` |
| Workspace | `4e775109-9f6f-4264-88c8-2c3c5b944a9b` |
| Location | `0abd559d-acfc-4073-aa7f-a68309fe80e0` |
| Chaos batch | `37534979-799c-46b3-8534-a50e22083540` / CS-000016 |
| Chaos session | `cf1f1824-0675-47c4-9a79-2592987d6449` |

The event chain explains the mismatch:

- 2026-09-16 17:59:31 UTC: `inventory_created`, 0 + 2 = 2, scanner source,
  linked to the original Chaos batch. The position still has this update time.
- 2026-09-17 05:07:30 UTC: `quantity_removed`, 2 - 1 = 1, collector workspace
  source. The item decreased but the position did not.
- No active marketplace reservation/allocation was found for this item.

`public.remove_inventory_lot_quantity(text,integer,text,text,inventory_event_source)`
updates only `inventory_items`. The deferred `pos_private.check_stock()` trigger
then sees tracked quantity exceeding total stock and correctly aborts. This is
not a `TD_COLLECTOR_UNAUTHORIZED`, event-enum or FK failure. The guard must stay.

## Full path and scope

`CollectorWorkspace.handleBulkRemove` sends selected item IDs and an operation
key to `src/app/api/collector-workspace/bulk-remove/route.ts`. The route requires
`collection.write`, authenticates the user, and selects only that user's rows.
For each positive row it calls `remove_inventory_lot_quantity` for the complete
current quantity. The owner-filtered SECURITY DEFINER RPC invokes the existing
collector authorization and workspace-writer triggers on update, then inserts
the negative `quantity_removed` event. Deferred stock constraints run at commit.

This is **not Chaos-only and not all removals**: any tracked inventory can suffer
the item/position synchronization defect. An unpositioned manual control succeeds
with the original RPC in the same restored database and owner context. Production
has 30 items whose position totals exceed item quantities; this change does not
bulk-repair them. It also has 27 items without positions. No positive unpositioned
control was available for the affected owner, so the manual comparison used a
synthetic local fixture, not another customer's live mutation.

Collection removal remains canonical-owner based; this API does not accept a
current-workspace selector. POS staff delegation does not confer collection
removal rights. The old event writer used obsolete JSON `workspaceId`; the repair
uses `inventory_items.workspace_id` without changing the item's assignment.

Bulk API calls are separate transactions per item. The existing generic response
claiming “Nothing was changed” is not a guarantee for earlier successful items in
a multi-item request. This reproduction used one affected item. No live retry was
performed; a future bulk atomicity/message change is separate from this RPC fix.

## Proposed forward repair

Only new migration:
`20260922212715_collector_removal_position_authority.sql`.

- Replaces only the existing removal function, retaining its signature and owner
  predicate. Uses an empty explicit search path and the existing collector owner
  advisory lock. No trigger, policy, feature flag or historical migration changes.
- Locks the item and positions. For one matching active position, updates position
  and item together; quantity zero marks the position `depleted` and preserves the
  item/event/batch/session records. Unpositioned inventory still works.
- Rejects multiple positions rather than selecting an arbitrary lot. Rejects any
  active allocation/reservation; this is intentionally conservative even if some
  unreserved quantity remains.
- For legacy excess position quantity, requires one position with matching
  location and owner batch, compatible workspace, and a complete contiguous ledger
  beginning at the original batch-linked creation quantity, followed solely by
  collector removals newer than the position's last update. Its final quantity
  must equal the current item quantity. Otherwise stops for review.
- Records the earlier alignment amount and supporting event IDs separately from
  the new requested removal. For this case, position 2 becomes 0: one unit accounts
  for the already-recorded prior removal and one for the new removal. The new
  event is **1 - 1 = 0**, not another two-unit removal.
- Records actor, position and batch provenance in event metadata; uses canonical
  workspace, existing location FKs and unchanged card identity snapshots. No
  language/game identity is invented. Historical events are not rewritten.
- Same-key retries do not create new removals; reusing a key with a different item
  or quantity fails. Event insertion conflicts abort instead of losing the audit.

The migration itself performs **zero row backfills**. Alignment occurs only inside
an explicit owner removal satisfying all checks. No general migration bypass or
temporary elevated helper exists. Existing collector authorization, RLS and stock
guard remain byte-for-byte unchanged.

## Rehearsal and validation

Target: isolated `collector_removal_rehearsal`, cloned from the verified repaired
production/Supabase installation rehearsal. Supabase Postgres 17.6 image;
Docker networks disconnected. No staging overwrite, hosted mutation, email or
external integration. All fixture/removal transactions roll back.

Run `node tests/collector-removal-rehearsal.mjs` with that local container running.
The test deliberately restores the old RPC in this disposable clone, reproduces
the error on the restored affected row, then applies the proposed definition.

Verified:

- Original affected-row error and successful original manual control.
- Repaired affected row: item 1 → 0, position 2 → 0, one new event with separate
  prior-removal evidence; batch, owner, workspace and card identity preserved.
- Synthetic normal and Chaos inventory: 3 → 1 → 0, exact negative event quantities,
  canonical workspace, retained history and depleted position.
- Idempotent retry and conflicting-key denial.
- Unexplained drift, multiple positions and reservations fail closed.
- Cross-tenant/nonowner denial, anonymous execute denial, existing collector
  authorization failure retained.
- Existing cash/security regression with an additional check that a genuinely
  site-delegated POS employee still cannot call general collection removal.
- Full item/event/position/batch/session hashes unchanged by the definition-only
  migration and after test rollback; RLS and stock/collector function hashes equal.
- TypeScript and 960 root tests pass. ESLint passes with zero errors and 535
  warnings. Final Supabase rehearsal, including the delegated cash/security
  fixture, passes. No UI/runtime TypeScript code changed.

## Production approval gate and risk

**Not applied to production. Not merged or deployed.** The affected production row
was not mutated. Final read-only baseline: 1,515 inventory rows, 1,782 units,
1,559 inventory events, zero enabled POS workspaces, zero Square connections and
credentials. Square execution configuration was not changed.

Before approval/execution, recheck current function definition, the exact affected
position/event chain, reservations and baseline totals. Apply only the new file
through the repository migration path. Installation should hold a short function
catalog lock; it has no stock-table backfill. Real request work locks one owner's
inventory operation and the selected item/position and reads its event history.

After installation, first verify function definition, grants, unchanged RLS/stock
guards, unchanged data totals, and disabled POS/Square. A later real removal still
changes user inventory and must be explicitly intended by the owner. Never use a
diagnostic deletion to verify installation. Ambiguous cases require review.

Rollback is a forward function-definition correction, never deletion of events,
batches or inventory. Restoring the old function would reintroduce the bug; if
necessary pause collection removals while correcting it. Preserve completed event
history. No production database restore is necessary for this definition-only
migration, and no production changes are authorized by this report.
