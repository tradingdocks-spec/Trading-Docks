# Production POS installation readiness — 2026-09-21

**SAFE TO INSTALL — reviewed repaired baseline only; owner execution approval required.**

This is an installation rehearsal, not production execution or pilot approval. Production and staging were inspected read-only. No production migration, deployment, configuration, sale, refund, workspace enablement or Square connection occurred.

## Installation artifact and order

Apply exactly one new file, in one explicit transaction, only after separate owner approval:

1. `supabase/migrations/20260921220051_pos_forward_installation.sql`
2. Record that file alone in `supabase_migrations.schema_migrations`, retaining its exact SQL.
3. Verify invariants before COMMIT; repeat read-only checks after COMMIT.

Do not use blind `supabase db push`: this production ledger intentionally does not contain historical POS migrations. Do not replay them or mark them applied. No application change, merge, deployment or POS continuation accompanies this plan. The new file is not idempotent: it rejects already-installed/partial installations rather than hiding collisions.

The file was created with the Supabase migration CLI. Its SHA-256 and measured installation duration are in [rehearsal evidence](pos-production-installation-rehearsal.json). The full object-by-object inventory, definitions, grants, columns and dependency references are in [object manifest](pos-production-installation-objects.json).

## Baseline and exact difference

Read-only catalogs were captured from production `bohddnajlnmknngzjsjk` and POS staging `ukrcbmujzdyclrkghbvo`. Staging's final POS definitions were reconciled with the already-deployed compatibility authority; unrelated staging features were excluded. The local branch contains the deployed application contract and makes no runtime source changes.

The verified Supabase recovery database was cloned; the four already-completed production compatibility repairs were applied to that clone solely to reconstruct the current repaired baseline. Its complete captured application catalog matched current production, normalizing only JSON key and ACL ordering. It contained 16 migration entries, 1,515 inventory rows, 1,788 units, 1,550 events, 1,488 exact stock positions, 26 label identities and zero unscoped inventory rows. Inventory, events, workspace/member, batch/session, position, location, label and migration fingerprints matched live production. Five Auth user keys, five identity owner keys and membership linkage also matched. Auth's complete live row fingerprint has changed since the recovery snapshot; the rehearsal does not claim byte-identical current login metadata. Full restored Auth rows were unchanged by installation and tests.

| Category | New installation | Existing objects |
| --- | --- | --- |
| Tables | 43; exact names and required-by functions in manifest | All 135 original application tables retained |
| Columns | 340 on those new tables | Zero columns added/changed on existing tables |
| Indexes | 33 explicit + 65 constraint-backed = 98 | Existing indexes retained; three new supporting indexes on existing stock tables |
| Constraints | 197 table constraints + 3 catalog entries for deferred constraint triggers | Existing constraints retained |
| Functions/RPCs | 49 | One narrow collector-function extension; all other original definitions/ACLs unchanged |
| Triggers | 30 | Existing triggers retained and enabled |
| RLS | Enabled on all 43 new tables | Existing RLS/policies unchanged |
| Policies | Zero new policies: checked RPC-only access | No browser table grants or permissive policy added |
| Grants | Exact table/function ACLs in manifest; only intended entry points executable | No general inventory write expansion |
| Schemas | Zero | Existing `pos_private` and `inventory_private` reused |
| Types | Zero custom enums/domains | 43 implicit table composite types and their arrays |
| Sequences | One private audit identity sequence | No browser sequence privileges |

The supporting indexes are `pos_inventory_search`, `pos_stock_positions` and `pos_stock_reservations`. The deferred trigger constraints are `pos_stock_item`, `pos_stock_position` and `pos_stock_allocation`; these account for the additional three `pg_constraint` entries, not duplicate table constraints.

The 43 tables cover settings/site-to-stock mapping, delegation/audit, registers/sessions, sales/items/allocations/tenders/cash, approvals/receipts/refunds, payment checkout/attempt/refund/event state, and private Square OAuth/credentials/location mapping/observations/deduplication/Terminal state. Current payment RPCs still reference private deterministic provider-test tables, so those empty structures are required for the current function contract; no test provider is enabled or seeded. The manifest lists every table's current function references and unrelated staging tables intentionally excluded.

The public application entry points installed are `pos_command`, `pos_payment_command`, `pos_payment_refund_command`, `pos_square_settings`, `pos_terminal_devices`, `pos_provider_request_budget`, and server-only `pos_square_service`. Existing label access/target/location/barcode RPCs are reused. Functions are installed from their final definitions, not intermediate historical wrappers replayed in sequence.

## Objects deliberately preserved

No recreation or backfill of `inventory_label_identities`, `inventory_barcode_aliases`, `label_templates`, `pos_private.label_tombstones`, existing inventory/position compatibility columns, or label identity/access/location/target functions. No recreation of `pos_private.inventory_entitled`, repaired Chaos commit, collection split, manual inventory create, private workspace resolver/writer, or their two BEFORE triggers. No rerun of workspace assignment. Exact preserved names are in the manifest.

The new `authorize` and `can_transact` definitions use the repaired `inventory_entitled` predicate rather than restoring the obsolete seller/store-only owner check.

The one existing function changed is `enforce_collector_inventory_mutation()`: the repaired algorithm is preserved, with the accepted POS exact-stock permit hook added for delegated updates. The private permit binds transaction, backend, actor, canonical owner, inventory item, complete before-row and exact after-quantity. It permits only the reviewed stock/value/timestamp change; it is consumed by the operation and is not a general migration bypass. The ordinary unauthorized collector mutation still raises `TD_COLLECTOR_UNAUTHORIZED`. No persistent migration flag or disabled trigger is introduced.

## Rehearsal and security results

Target: local official `public.ecr.aws/supabase/postgres:17.6.1.167`, PostgreSQL 17.6. Database `pos_install_baseline` represents repaired production; disposable `pos_install_rehearsal` receives only the new installation. The original recovered `postgres` database and backup files remain intact. The recovery container had no Docker network connections, no application pointed to it, and external-service containers remained stopped. Background preload workers were temporarily suppressed for cloning; original settings were restored before stopping this recovery container.

- Atomic installation passed with no object collisions and no historical POS replay; ledger grew 16 → 17 with only the new file and its exact SQL.
- Full-row fingerprints of 137 original application/Auth tables remained unchanged, including owner, quantity, workspace, batch, location, event and allocation data. No existing-row backfill or assignment occurs.
- All original tables/columns/indexes/constraints/policies/triggers/enums and grants survived. All original functions were unchanged except the exact permitted collector hook.
- All new sensitive tables have RLS and no anonymous/authenticated direct table privileges. Private functions and server-only Square execution deny browser roles. The audit sequence also denies browser access.
- Owner setup/search/operations passed without the former entitlement mismatch. Non-delegated manager denied; delegated employee can sell only within the granted site and stock owner; another site denied; revocation effective. Unauthorized general inventory mutation, cross-tenant access and anonymous access denied.
- Existing workspace-writer triggers remain enabled. New constraints/indexes are valid; no residual stock permit survives a completed delegated operation.
- Disposable workspace only: setup register, open $200, search/resolve barcode, $1 synthetic sale with synthetic 8.5% tax, exact quantity 3 → 2, receipt, duplicate checkout prevention, refund/replay prevention, exact restock 2 → 3, close and report with zero variance passed. These fixture prices/tax are not production price/tax approval.
- Test workspace explicitly disabled; all fixture writes and sales/refunds then rolled back. Post-test original full-row fingerprints and ledger unchanged. Zero enabled workspaces, Square credentials, connections or devices.
- Root unit suite: 960 passed. Focused runner ESLint and whitespace checks passed. No runtime/mobile changes, so no new application build is claimed. Security evidence is direct privilege/RLS/function inspection and adversarial SQL tests, not a hosted Supabase Advisor scan of an undeployed migration.

Reproduce only in the isolated recovery target:

```text
node tests/pos-forward-installation.mjs --evidence-dir <owner-controlled-directory-outside-git>
```

The runner refuses other database names/connected Docker networks and replaces only its named disposable rehearsal database. It never loads hosted credentials. Raw source data and test logs stay outside Git. [SQL pilot tests](../tests/pos-forward-installation.sql) are guarded by the rehearsal database name and roll back.

## Data, locks and transition

Expected changes to existing inventory, events, ownership, quantities, workspaces and marketplace allocations: **zero**. New POS tables start empty; settings default disabled. No merchant, credentials, terminal, tax setting or register is created in production by installation.

The measured local wall time is recorded in the evidence JSON (includes Docker/psql overhead). Production contention is unmeasured. Index builds on existing tables block concurrent writes; FK/trigger installation and DDL require locks. Use a quiet several-minute maintenance window with inventory, Chaos and marketplace inventory mutations paused. Set the file's 5-second lock timeout and 60-second statement timeout. On contention, roll back and reschedule rather than extend locks or disable authorization.

Use one transaction: no application sees intermediate tables/functions or unvalidated constraints. Existing Label Studio/Chaos/writer objects are not replaced by historical versions. Requests may briefly wait or time out while locks are held. After commit the schema is installed but settings remain empty/disabled; production Square runtime still unconditionally rejects `VERCEL_ENV=production`. Do not remove that guard or change environment settings.

## Exact preflight and verification

1. Reconfirm recoverable backup of the then-current repaired production state. The preserved recovery backup plus four repaired-baseline steps were rehearsed here; do not assume an old snapshot captures later customer writes.
2. Run [read-only preflight](POS_PRODUCTION_INSTALLATION_PREFLIGHT.sql) immediately before future execution. Require 1,515 rows / 1,788 units / 1,550 events / zero unscoped, the reviewed 16 ledger entries, no new POS object collision, no function drift, enabled writer triggers and no orphan memberships. Changed live data requires renewed comparison/rehearsal, not forced expected counts.
3. Capture [catalog](../tests/pos-installation-catalog.sql) and private full-row fingerprints. Compare against the accepted baseline. Check no changed columns, grants, policy/constraint/trigger definitions, provider credentials or production enablement configuration. A function-hash check alone is insufficient for complete schema drift review.
4. With mutations paused, execute only the new file and ledger record in a single transaction using `ON_ERROR_STOP`. Never let a CLI discover and apply missing historical files automatically.
5. Run [verification queries](POS_PRODUCTION_INSTALLATION_VERIFICATION.sql) **inside that transaction with the query file's outer BEGIN/COMMIT omitted**. Compare full original-row hashes and catalog difference with the manifest, not only row totals. Require all new objects/privileges correct, ledger 17, zero enabled settings/provider state, unchanged owner/workspace/stock/history and unchanged label/writer authority. Commit only on all checks passing.
6. Repeat read-only verification after commit. Perform owner read-only Inventory, Collection, Chaos Sort, Label Studio, Orders and marketplace smoke checks; POS must still report disabled. Review application logs. Do not run the disposable SQL pilot against production.

Stop immediately on any missing prerequisite, drift, duplicate object, ambiguous workspace state, count/hash/ownership change, RLS/grant failure, changed collector behavior, unexpected ledger entry, enabled workspace/provider state, timeout or failed verification. No automatic remediation or partial commit.

## Disable/recovery strategy and owner gate

Before commit: ROLLBACK restores the pre-installation state atomically. After commit: leave POS disabled and Square blocked; do not drop tables or reverse inventory/financial history. Investigate and use a separately reviewed forward correction. If full recovery is required, rehearse the verified restore into an isolated target and obtain owner approval for cutover, accounting for writes after the backup. Restoring over live production is not an automatic rollback procedure.

**SAFE TO INSTALL** means the single forward installation satisfies the current application database contract in the repaired production-shaped Supabase rehearsal. It is conditional on unchanged final preflight and a fresh owner execution approval. It does not authorize a live pilot or production Square. Physical hardware certification remains unchanged and pending.

The live pilot remains on hold: no Phoenix Store location will be invented. `UC Bulk Boxes` must be confirmed as the intended owner stock location; one exact card, explicit price, language and tax applicability need approval before any production sale. The prior $200 opening float is not authorization to sell an unspecified item.
