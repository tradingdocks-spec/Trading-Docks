# Production migration readiness — September 21, 2026

**Current final verdict: NOT SAFE TO APPLY.** The [forward compatibility repair](POS_PRODUCTION_COMPATIBILITY_REPAIR.md) resolves the original schema/Chaos/entitlement defects in disposable tests. It exposes 1,489 owner inventory rows without a workspace association (1,460 positive quantity), leaving the real owner's label targets empty. Assigning them or weakening the workspace predicate is outside the no-data-change repair. Owner scope decision and another reviewed rehearsal are required. Production remains untouched.

**Superseding focused review: NOT SAFE TO APPLY.** See [Label Studio repair review](POS_LABEL_STUDIO_PRODUCTION_REPAIR_REVIEW.md). The accepted 12-file DDL/backfill result below is historical evidence, not a complete runtime dependency proof. Additional testing found missing Chaos position `language`, a Chaos commit regression when its historical migration is replayed, and a platform-owner label authorization mismatch. Do not execute the migration instructions below until a forward repair is reviewed and rehearsed.

**Database rehearsal: PASS. Current live non-POS compatibility: BLOCKED by Label Studio. Production migration execution: NOT APPROVED / NOT PERFORMED.**

The exact 12-file migration sequence succeeds on a disposable PostgreSQL 17 database reconstructed from production schema metadata. All 1,489 missing-game rows can be safely backfilled by the existing reviewed migration. There are **zero unclassified or conflicting rows** in this snapshot. No new migration or application feature was written.

This is not an unconditional production readiness PASS: the deployed Label Studio currently depends on an unapplied column and fails to load normally. Stop at the owner decision gate below. Do not use this report as authorization to migrate, enable POS, connect production Square, or process money.

## Scope and evidence

- Deployed code: `14a0488b842d8731c2b69e33c235234ddf380cf3`, merged PR #119. Vercel deployment `dpl_EhagUAvNGo6z8V8D79Nge7n8Sa5S` is READY and serves the production domains.
- Production inspected read-only: `bohddnajlnmknngzjsjk`, PostgreSQL 17.6.1.147. Every metadata/data inspection used a read-only transaction. No production DDL, backfill, grant, enablement, credential or deployment-setting change was performed.
- Final production baseline: `2026-09-21T19:25:03.275542Z`; 1,515 inventory rows, 1,788 units, 26 canonical labels, five workspaces, zero POS tables. Production migration ledger still contains the same 12 existing entries.
- Machine-readable manifest, timings, checks and schema deltas: [pos-production-schema-rehearsal.json](pos-production-schema-rehearsal.json).
- Rehearsal runner: [production-schema-rehearsal.mjs](../tests/production-schema-rehearsal.mjs). Post-migration read-only queries: [POS_PRODUCTION_MIGRATION_VERIFICATION.sql](POS_PRODUCTION_MIGRATION_VERIFICATION.sql).

The runner connects only to a newly initialized loopback database on port 55459. It does not read application environment files or accept a remote database URL. It reconstructs all **133 public tables**, the referenced `auth.users` shape, enums, **83 public/Auth functions**, **714 constraints**, **224 non-constraint indexes**, **189 policies**, **28 public row triggers**, object grants/owners, relevant production default privileges, and the public-table RLS event trigger. The initial collector function is verified byte-for-byte against the production export.

Fixture scope: all 1,515 inventory rows and 26 canonical label identities are represented with deterministically remapped IDs, owner/workspace relationships, quantities, identity/classification fields, timestamps and relevant metadata. Display names/barcodes are sanitized; unrelated inventory JSON is omitted. Effective membership tiers are reproduced through local overrides, not a copy of private billing/Auth records. Other business tables are schema-only. Production has zero label templates; its two print-job payloads were not copied. This is a schema-equivalent, inventory-shaped rehearsal, **not** a complete production backup, PostgREST deployment, auth-service replica, or concurrent production workload simulation. Supabase extension management/GraphQL/Realtime event hooks are not exercised. These limits particularly constrain runtime estimates and end-to-end post-migration UI claims.

Raw schema and sanitized fixture artifacts remain ignored under `.local-fixtures/`; no customer records, credentials or session tokens are committed. To repeat this exact local capture, run `node tests/production-schema-rehearsal.mjs` with those fixtures and the existing `.local-fixtures/pos-db` runtime. Refresh the read-only metadata and classification capture before a future approval window; do not substitute the simplified `tests/fixtures/pos-prerequisites.sql`.

## Signed-in production coexistence

Checks used the owner's production browser session and normal read/navigation controls. No order fulfillment, stock changes, imports, template saves, print-job creation, or other business writes were submitted.

| Workflow | Observed result |
| --- | --- |
| Dashboard | PASS read smoke: live revenue/order/inventory panels rendered. Vendor/supply metrics displayed Unavailable; those integrations were not certified by this check. |
| Inventory | PASS read/search smoke: loaded inventory, searched Michelangelo and received seven results. |
| Collection | PASS read smoke: binder navigation and collector portfolio rendered existing binders and collection totals. |
| Game context | PASS: Magic returned inventory; Pokemon returned an empty result; All filter restored. |
| Orders | PASS read smoke: existing order list and controls rendered. No fulfillment/refund changes attempted. |
| Chaos Sort | PASS read smoke: existing batches and sorting/import workspace rendered. No scan/import committed. |
| Label Studio | **FAIL: generic operation error, empty preset control and disabled preparation.** |
| Deck Vault | PASS read smoke: deck workspace and empty deck state rendered. |
| Inventory Inbox | PASS read smoke: database-level inventory issue counts and queues rendered. |
| Selling overview | PASS read/navigation smoke. No listing published. |
| Business reports | Rendered its empty-report state without a route crash. Dashboard/report financial agreement is **not verified** by this read smoke. |
| POS | PASS gated: “POS is not available yet” and reviewed-migration/rollout requirement shown. No active register offered. |

Public desktop/mobile checks passed on home, pricing, sign-in, privacy, terms, security, hardware center and two printer detail pages. Anonymous dashboard/POS pages redirected to sign-in; tested POS APIs returned 401. Vercel error-log queries returned no entries during sampled windows, **but that does not negate the visible Label Studio failure**: this route returns an error response without logging its underlying database error.

### Label Studio blocker

`src/app/api/label-studio/route.ts` filters canonical identities with `.is("inventory_position_id", null)`. The production table has no `inventory_position_id` column. The production snapshot also lacks `label_targets`, `label_locations`, `set_default_label_template` and other new Label Studio RPCs supplied by migration 2. This establishes a code/schema dependency outside the gated POS register.

The disposable rehearsal reproduces the undefined-column failure before migration. After the ordered migration, the identity query runs and all 26 identities remain unchanged. This confirms the database prerequisite repair, **not** a hosted post-migration Label Studio PASS. No production migration or compatibility hotfix was applied to conceal the failed gate.

## Exact execution order

Execute only these reviewed repository files, unchanged, in this order after separate approval. SHA-256 hashes are in the accompanying JSON manifest.

1. `20260920181448_pos_cash_foundation.sql`
2. `20260920190428_pos_barcode_labels.sql`
3. `20260920201259_pos_staff_delegation.sql`
4. `20260920201754_pos_register_operations.sql`
5. `20260920211929_pos_payment_framework.sql`
6. `20260920220340_pos_square_sandbox.sql`
7. `20260920235705_pos_square_terminal.sql`
8. `20260921004339_pos_provider_request_budget.sql`
9. `20260921010637_pos_employee_permission_precedence.sql`
10. `20260921014756_pos_search_authority_scope.sql`
11. `20260921020747_pos_cart_scale_500.sql`
12. `20260921154907_inventory_identity_trusted_backfill.sql`

Do **not** replay `202608120001_multi_tcg_inventory_identity_proposal.sql`, edit applied files, bulk-push all locally absent ledger versions, or repair production migration history as part of this report. Production has schema objects whose historical repository timestamps are not recorded in its current ledger; a blind migration push is unsafe. The selected POS objects are absent and the 12-file manifest is the rehearsed forward path. Record each approved migration through the normal migration runner with its reviewed name/hash and actual assigned ledger version. The rehearsal ledger preserved the 12 baseline entries and recorded exactly 12 new entries without duplicates.

## Expected schema and data changes

- 45 new tables: 24 public `pos_*` tables, public `inventory_barcode_aliases`, and 20 `pos_private` tables. These cover workspace opt-in, sites/registers/cash, immutable sales/refunds, approvals/delegation, payment reconciliation, Sandbox connection/event/device state and transaction-bound stock permits. Full names are in the JSON manifest. No enabled workspace, production credentials or real payment data is created.
- Public/private function count becomes 136 in this captured schema. Only two pre-existing function definitions change: `enforce_collector_inventory_mutation()` gains the already-reviewed, exact-row/transaction-bound delegated POS stock path with an empty search path; `reserve_selling_inventory(uuid,uuid,integer,text)` gains stock-race coordination. Existing execution grants on both remain unchanged.
- Labels gain position/location target columns, additional identity indexes, alias/tombstone protection and label RPCs. `label_templates.width/height` become `numeric(12,6)`; production currently has no template rows to convert. The active-item unique index is replaced with the reviewed position-aware predicate. Print-job maximum page count increases from 1,000 to 10,000; label count stays capped at 10,000. Browser DELETE on canonical label identities is revoked. Other pre-existing table grants are unchanged.
- All existing policies, row-trigger definitions/enabled states, FKs and constraints remain, except the reviewed print-job count replacement. All pre-existing indexes remain except the reviewed active-item replacement. Four pre-existing inventory checks remain `NOT VALID`; the migration does not claim to validate historical constraints unrelated to this work. All new checks/FKs are validated and indexes valid.
- All nine multi-TCG columns and six game-context indexes already exist in production. Migration 12 is principally the missing data backfill here. `game_id` uses the existing allowed-value CHECK, **not a game-table FK**. Existing user/workspace FKs are preserved.

| Inventory classification | Exact count |
| --- | ---: |
| Backfill `game_id` to `magic` and null `provider_category_id` to `1` | 1,489 |
| Already `magic` / `card` / provider category `1`; unchanged | 26 |
| Missing-game rows skipped for lack of evidence | 0 |
| Conflicting rows / manual review | 0 |
| Total rows after | 1,515 |
| Total quantity before and after | 1,788 |

All 1,489 candidates have a syntactically valid Scryfall UUID, no conflicting explicit game hint under the migration's exact predicate, and no conflicting provider category. `product_type` is already `card` on all rows, so no product-type values need changing. No game is guessed for evidence-free data. If this classification changes before execution, stop and classify the exact new cases again.

The rehearsal compared every row before/after: only the intended two metadata values changed; row keys, owner/workspace/location, quantities, prices, timestamps and all retained other fields were identical. Canonical labels were identical. The production baseline fingerprints are included in JSON for reference; capture fresh fingerprints in the actual approved maintenance window.

## Authorization and regression results

- The original production trigger rejects an unowned metadata UPDATE with `TD_COLLECTOR_UNAUTHORIZED`.
- Migration 12 independently succeeds under that exact production trigger, restores it, and rolls back cleanly in the isolated test.
- The complete ordered sequence also succeeds; the temporary refinement restores the **immediately preceding reviewed staff-delegation trigger**, rather than reverting the legitimate delegation migration.
- An attempted owner reassignment through a tampered local backfill is rejected. Normal unauthorized writes remain rejected; owner reads, game filtering and metadata updates work. Cross-tenant browser reads/updates expose or affect zero rows.
- No migration helper, temporary-row reference, migration-mode flag or persistent authorization branch remains. Browser execution of the migration is denied. Anonymous POS RPC execution and browser access to private POS helpers/writes are denied.
- Existing production RLS flags remain intact. Production's default public creation grants and automatic-RLS hook were included before applying the manifest, so the grant checks do not rely on a more restrictive clean PostgreSQL default.
- All five reconstructed workspaces remain blocked: eligible Store owner receives `POS_DISABLED`; ineligible tiers remain forbidden. Settings `enabled` defaults to false, and no enabled row exists.
- `npm run test:pos:db`: **132 passed for each ledger variant**, including staff/delegation boundaries, trusted backfill security, races, reconciliation, and 25/100/250/500-line carts. These broader scenarios use the repository's separate synthetic test fixtures and must not be confused with the production-shaped test.
- `tests/pos-square-runtime.test.ts`: **2 passed**. The deployed code returns false immediately for `VERCEL_ENV=production`; main is also outside the exact staging allowlist. Database migration cannot enable production Square. No provider call was sent from production to test this guard.

## Locking, runtime and execution precautions

The exact local milliseconds per file are recorded in JSON. The full DDL/backfill sequence took well under one second locally; the 1,489-row backfill was approximately 0.17 seconds. This excludes database reconstruction, full production JSON payload sizes, network round trips and concurrent workload, and is **not a production duration guarantee**.

Migration 12 holds `ACCESS EXCLUSIVE` on inventory while taking the before/after snapshot, temporarily refining the trigger and updating/verifying rows. Reads and writes can wait behind it. Label column/index/constraint changes also take table locks; FK creation briefly locks referenced tables. A waiting exclusive lock can queue traffic even before the backfill runs. Use a reviewed low-traffic window, inspect long-running transactions, and set a short lock timeout (rehearsed: 2 seconds) and bounded statement timeout (60 seconds). Do not terminate unrelated sessions or force the migration through a lock conflict. A timeout is a stop/retry decision for the owner.

Run each whole file atomically under the trusted migration role (`session_user=current_user=postgres`, `role=none` for the backfill). Do not split the DO block or introduce trigger-disable statements. Check hashes and fresh schema/data classification before beginning; take/verify the separately approved recovery snapshot. Keep application POS flags and all workspace opt-ins disabled throughout.

## Rollback / disable strategy

Before any file commits, a failure rolls its transaction back, including the temporary collector refinement. Stop the sequence at the first failure. Earlier committed files remain; do not pretend per-file transactions roll back the whole sequence.

After commit, retain the schema and financial audit structures and keep POS disabled. Do not drop tables, reverse inventory history, clear provider IDs, or null out correctly classified game identities as a generic rollback. Prefer a reviewed forward repair. An application compatibility fix or application rollback is a separate owner-authorized action; the pre-existing Label Studio issue cannot be treated as resolved merely because the migration is planned. Database restore requires a separate recovery decision accounting for legitimate writes since backup.

No POS opt-in or production provider configuration should be added at this gate. If a future independently approved pilot has enabled POS, its disable operation requires its own reviewed scope and must preserve unresolved payment recovery and immutable history. Physical hardware acceptance and pilot readiness remain separate gates.

## Final owner gate

**Safe row classification/backfill: YES for this captured dataset. Ordered database migration rehearsal: PASS. Unconditional production readiness approval: HOLD.**

There is no identified unsafe inventory row requiring manual classification. The focused Label Studio review now demonstrates prerequisite and authorization defects; production migration approval must remain on hold until a forward repair passes rehearsal. Approving the existing 12-file sequence alone is not a demonstrated Label Studio repair. See the superseding review above for the exact failures.

After an approved migration, run the supplied read-only queries and compare the new ledger to the manifest, then repeat signed-in Label Studio/Inventory/Collection/Orders/Chaos Sort/dashboard checks while POS remains disabled. No production approval is implied by this report or by the prior code merge.
