# Production migration readiness — September 21, 2026

**SAFE TO APPLY — compatibility, future-writer and deterministic workspace repair only, pending explicit owner execution approval.** Production remains untouched. This is not approval for production POS installation, application deployment, Square configuration or tenant enablement.

The disposable production-shaped rehearsal preserves 1,515 inventory rows, 1,788 units, 1,550 events and canonical owners. Exactly 1,489 rows change only `workspace_id`: 19 use explicit event evidence and 1,470 the sole eligible owned workspace. The other 26 remain unchanged. Ambiguous/unresolved cases: **0**. Positive workspace-backed inventory with NULL scope after repair: **0**. The separate game identity backfill is not executed here.

## Exact dependency order

| Order | Migration | Existing inventory changes |
| --- | --- | --- |
| 1 | `20260921195747_label_production_compatibility.sql` | 0; nullable label/position schema, label authority and RPCs |
| 2 | `20260921195836_chaos_and_pos_authority_compatibility.sql` | 0; qualify Chaos locals, align installed POS entitlement predicates |
| 3 | `20260921203415_inventory_authoritative_workspace_writer.sql` | 0; validated creation-time scope and scope-aware RPCs |
| 4 | `20260921201424_inventory_workspace_assignment.sql` | Exactly 1,489 workspace fields; all other fields unchanged |
| 5 | Verify before commit | 0 |

**Dependency order differs from timestamp order.** The assignment file remains immutable and must run after the newer writer correction. The eventual authorized executor must apply these exact files in this order and record each actually applied migration in the ledger in the same controlled transaction. Do not use blind `db push`, replay historical migrations, or mark skipped migrations applied. The original 12-file POS list overlaps the standalone label repair and still requires a separately reviewed forward continuation plan.

## Authoritative writer audit

| Path | Previous behavior | Correction |
| --- | --- | --- |
| `commit_chaos_sort_batch` | Batch/inventory INSERT omitted scope; matching ignored workspace | Batch BEFORE INSERT validates context; inventory INSERT resolves batch scope; identity matching and events use that scope |
| `src/lib/inventory-persistence.ts` generic item upsert | Manual/persisted inventory omitted scope | Shared database BEFORE INSERT resolves scope; existing scoped upserts preserve it |
| `BulkPurchasesWorkspace.tsx` CSV/bulk imports | Direct 500-row upserts omitted scope | Same per-row database validation, atomic rejection on ambiguity |
| `create_inventory_item_with_event` | Manual/collector/mobile scanner create omitted scope | Explicit `p_inventory.workspace_id` validated or scope resolved; event uses the returned row's workspace |
| Web/mobile collector mutations, scanner replay | Use create RPC; quantity changes update existing rows | Creation corrected centrally; scoped updates remain scoped |
| `move_inventory_lot_quantity` | Partial collection split omitted scope | Carries source workspace into validated INSERT and event history |
| Marketplace/eBay intake | Order/listing import reads matching inventory; candidates/allocations reference inventory | No inventory-creation path found; no marketplace ownership change added |
| POS returns/refunds | Update existing owner stock through restricted stock permits | Preserve owner/workspace; reject restoration of required-but-unscoped stock pending repair |

Audit covered active `src/`, active `mobile/`, repository SQL INSERTs and captured production function definitions. The inventory-inserting RPC families are Chaos commit, manual create and collection lot split. Generic persistence and import writes are covered at the table boundary. Historical mobile backups are not active application authority.

The resolver validates authenticated canonical owner, active Auth status, owned location and batch provenance. Explicit operation scope must pass database membership checks. Implicit fallback requires exactly one membership and one eligible owned workspace. Locations and sessions have no authoritative workspace field: names, JSON labels and browser preferences are never used to invent one.

Explicit shared-store context preserves the existing partner model: a workspace manager can place their **own** inventory in that workspace under the unchanged collector guard. Workspace association never transfers inventory ownership. Employee sell/return delegation does not authorize general inventory creation or Chaos on another owner's behalf; that unsupported path stays denied. Authorized delegated POS operations preserve stock ownership and record the employee as actor.

A blanket NOT NULL would break legitimate personal collector inventory. Private BEFORE triggers enforce the narrower relationship-dependent invariant instead. Scope is required for workspace owners, Seller/Store tiers and trusted platform owners/admins. Invalid explicit scope, foreign location/batch, banned owner, missing required scope or ambiguity fails closed. No cleanup job, public helper, broader service grant, disabled trigger, impersonation or persistent migration permit is added.

## Verification evidence

- Four-file production-shaped rehearsal passes: exact assignment, unchanged ownership/quantities/history, collector guard and inventory policies preserved, existing constraints/FKs/indexes preserved and valid, no residual assignment permit.
- New Chaos, manual RPC, import/upsert and collection split paths pass. Identical Chaos identities in separate workspaces remain separate. Ambiguous/missing scope, tenant injection, banned owner and browser helper calls fail. Personal collector creation remains compatible.
- Actual Label Studio component/renderer passes through a loopback SQL adapter: 500 owner targets and exact-position labels. New manual/Chaos rows are returned by label RPCs and receive canonical identities. This is disposable acceptance, not hosted production acceptance.
- Both POS ledger variants pass **134 checks**, including 25/100/250/500-line carts. Writer installed before operations/payment/Terminal regressions. New stock resolves through POS search and canonical barcode. Delegated refunds retain owner/workspace and actor; shared-store partner sales still pass. Unauthorized creation remains denied.
- Root suite: **960 passed**. No web/mobile runtime source changed in this correction; prior build/type/mobile results are historical evidence in the compatibility report.

Reproduce:

```text
node tests/production-schema-rehearsal.mjs --compatibility --workspace-assignment --future-writer
node tests/pos-db.mjs --compatibility --workspace-assignment --future-writer --large-cart
node tests/pos-db.mjs --compatibility --workspace-assignment --future-writer --large-cart --enum-ledger
```

Aggregate evidence: [writer rehearsal](production-workspace-writer-rehearsal.json). Raw fixtures remain ignored.

## Transition and owner execution gate

Use a quiet maintenance window with inventory/Chaos/import mutations paused. Execute all four files in **one transaction**, starting with bounded lock/statement timeouts (recommended 5 seconds/60 seconds), locking inventory before the first repair and holding assignment evidence locks through verification. Do not publish an intermediate commit. Otherwise Label Studio can still be empty before assignment, or legacy restoration can fail while the new writer awaits the backfill. The existing pre-repair Label Studio defect persists until commit; requests may wait or time out during maintenance. Pause/retry them rather than expose a partial repair.

Uncontended local assignment took approximately 0.4–0.6 seconds. DDL acquires column/index/trigger locks; assignment takes ACCESS EXCLUSIVE inventory and evidence locks. Production contention is unmeasured. Reserve several minutes for preflight/verification. On timeout roll back and reschedule; never disable authorization. This narrow plan creates no POS tables and does not change production Square guards.

Immediately before future execution, run [read-only compatibility verification](POS_PRODUCTION_COMPATIBILITY_VERIFICATION.sql) and the assignment migration's `BEGIN CLASSIFICATION` SELECT block read-only. Require the same 1,489/1,460/29 cohort, 19/1,470 rule totals, zero ambiguous/unresolved, identical owners/memberships and no new marketplace links. Capture full rows and guard/policy hashes for comparison. Changed evidence requires a fresh review.

After each critical file compare schema/function/ACL outputs from the verification queries. After writer installation require two enabled BEFORE triggers, safe empty search paths, no API helper execution grants. After assignment, before commit, require full-row equality except approved workspace fields, exact approved targets, unchanged row/unit/event counts and financial/marketplace records. Trusted verification:

```sql
select count(*) as missing_required_active_scope
from public.inventory_items i
where i.quantity > 0 and i.workspace_id is null
  and inventory_private.workspace_required(i.user_id);
-- Required: 0. Private helper; not a browser RPC.

select tgname,tgenabled,pg_get_triggerdef(oid)
from pg_trigger where not tgisinternal
  and tgname in ('a_inventory_workspace_at_write','a_chaos_workspace_at_write');
-- Both enabled: BEFORE inventory INSERT/UPDATE, batch INSERT.

select p.oid::regprocedure,p.proconfig,
  has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,
  has_function_privilege('authenticated',p.oid,'EXECUTE') as user_execute,
  has_function_privilege('service_role',p.oid,'EXECUTE') as service_execute
from pg_proc p join pg_namespace n on n.oid=p.pronamespace
where n.nspname='inventory_private';
-- All execution columns false; safe empty search_path.
```

Immediate stop/rollback: unexpected counts, owner/quantity/classification changes, altered RLS/collector guard, expanded permissions, missing label targets, unrecognized RPC body, exception, invalid index/constraint, unexpected POS enablement or timeout. Functional writes remain disposable until separately authorized; signed-in production acceptance follows an approved commit.

Before commit, failure means transaction rollback. After commit, preserve schema and all financial/inventory history; pause affected mutations and prepare a reviewed forward correction. Do not null workspace fields, drop history, disable guards or replay old migrations. Any application rollback needs schema-compatibility review. Stop at owner approval: no production operation is authorized by this report.
