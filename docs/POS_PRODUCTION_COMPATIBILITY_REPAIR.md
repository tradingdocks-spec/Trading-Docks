# Production compatibility repair — September 21, 2026

**Current decision: SAFE TO APPLY the four-file repair, pending explicit owner execution approval.** The [current migration readiness report](POS_PRODUCTION_MIGRATION_READINESS.md) supersedes the historical stop conditions below. The new authoritative writer correction precedes the accepted 1,489-row assignment. Production remains untouched; broader POS installation still needs a separate continuation plan.

The sections below preserve the original two-file diagnosis and its historical NOT SAFE result. That result led to the separately accepted assignment review and the now-rehearsed future-writer correction; it is not the current decision.

Branch: `codex/production-compatibility-repair`, based on current `origin/main` (`14a0488`). No historical migration was edited. No production SQL mutation, deployment, migration, POS enablement or Square configuration was performed. All repair execution was on loopback disposable PostgreSQL. Production inspection used explicit read-only transactions.

## Forward migrations

1. `20260921195747_label_production_compatibility.sql`
   - Adds nullable `chaos_sort_inventory_positions.language`, with no default or backfill.
   - Adds nullable identity `inventory_position_id` and `inventory_location_id`; permits storage identities without an item, with the existing accepted target constraint.
   - Installs the required label-only RPCs, canonical identity guards/tombstones, barcode aliases, indexes and restrictive label policies. Does not install POS sale/register/payment tables or commands.
   - Retains the accepted template precision and print-count constraint changes.
   - Adds private trusted entitlement/label authorization helpers and the authenticated `label_access` preflight RPC. The API now treats this database decision as authoritative after its existing capability precheck.
2. `20260921195836_chaos_and_pos_authority_compatibility.sql`
   - Qualifies the existing Chaos function's local `location_id` through an explicit PL/pgSQL block label, preserving the environment's current function body, signature, algorithm, owner and grants.
   - Where POS already exists, replaces only its entitlement predicates with the shared trusted helper. Does not install or enable POS where it is absent.

The first migration contains only the label subset of the accepted implementation, rather than copying POS finalization into a compatibility patch. Both files also pass against an already-installed POS schema. The new position/location fields remain text, matching the existing identifiers. No extra FK is introduced: existing item FKs remain, target checks validate the owner/item/position relation, and retirement/tombstones preserve label history when physical inventory positions disappear.

**Do not run the original 12-file sequence after installing this standalone label subset.** Historical migration 2 has non-idempotent creates that overlap it. A future POS rollout needs a separately reviewed forward continuation/installation plan. This repair does not mark skipped historical migrations as applied or alter the production ledger. Blind `db push`, historical replay and ledger repair are not approved.

## Original defects

Label Studio's already-merged bootstrap filters a column supplied by POS migration 2; its targets RPC additionally reads a language column from an earlier Chaos migration. Production has neither. Replaying the old Chaos file replaces the current commit algorithm, not merely its schema.

The historical ambiguity is a **PL/pgSQL variable/column collision** in the inventory candidate query: `coalesce(candidate.location_id, '') = coalesce(location_id, '')`. It is not a `RETURNS TABLE` alias or trigger `NEW`/`OLD` issue. The forward repair uses `compat_chaos.location_id` and qualifies the location lookup as well. It does not rename the public `payload` parameter or reinstall the historical algorithm. Valid production-shaped commits pass before repair and after each forward file.

The app grants trusted platform owners/admins full-tier capability access, but label RPCs called the POS helper whose entitlement predicate only recognized Seller/Store. The new private entitlement helper reads trusted `user_roles`, never browser metadata, and retains the ban check. Labels retain workspace membership, active employee checks, management role checks and own-inventory filters; explicit linked-member POS permission is not bypassed. The POS helper uses the same entitlement decision while retaining all existing permission, owner/delegation, site and enablement checks. Transaction code still checks stock availability and register/session validity. Platform role is **not** inventory ownership.

The production identity inspected read-only:

| Predicate | Observed value |
| --- | --- |
| Authenticated user / canonical owner | `Owner A (sanitized)` |
| Owned workspace | `Workspace A (sanitized)` |
| Workspace membership | owner |
| Trusted platform role | owner |
| Effective paid tier | free |
| Inventory ownership | 1,514 rows belong to this user |
| Owned inventory locations | 4 |
| POS sites, delegation table, register sessions | Absent in production; no eligible production POS operation |

No self-delegation is required. In isolated POS fixtures the same Free-tier/platform-owner shape can sell its own eligible inventory. Delegated staff still need scoped grants, permission and site mapping; non-delegated staff/managers, cross-tenant and anonymous access remain denied. Tests exercise these boundaries without changing production membership or grants.

## Newly exposed stop condition

After authorization is corrected, the real owner-shaped Label Studio query returns **zero eligible targets**. A fresh read-only production query confirms:

| Owner inventory association | Rows |
| --- | ---: |
| Workspace assigned, zero quantity | 25 |
| Workspace unassigned, positive quantity | 1,460 |
| Workspace unassigned, zero quantity | 29 |
| Total owner rows | 1,514 |

The other user's one row makes 1,515 total. The owner has **1,489 rows with NULL workspace_id**. Labels and POS deliberately require a matching workspace as well as matching owner. Removing that workspace predicate would weaken isolation; assigning these rows would be a data change outside the requested zero-backfill repair. Neither was done.

Owner decision needed: approve a separate, explicitly scoped inventory-to-workspace classification/backfill review, identifying the intended workspace for these rows. No UUID is inferred merely from an active session. That review must prove location/owner/workspace relationships, preserve inventory/financial history and rehearse any approved assignment through a new migration. Until then, authorization success or an empty Label Studio screen is not a successful production workflow acceptance.

## Data, RLS and transition effects

Both files update **zero existing inventory/identity/position data values**. All 1,515 inventory rows, 26 identities, five locations, 22 sessions, 22 batches and 1,488 positions remain unchanged, including ownership. The 26 identities gain NULL fields; 1,488 positions gain NULL language. No game identity backfill occurs. Functional probe writes are rolled back; one deliberate browser identity is created only in the disposable Store fixture after preservation checks.

Collector authorization is unchanged byte-for-byte. Unauthorized writes still raise `TD_COLLECTOR_UNAUTHORIZED`; owner metadata edits pass. Inventory policies remain unchanged. New label policies are restrictive; identities cannot be arbitrarily deleted or rewritten. Existing constraints/FKs and indexes compare equal except the reviewed print-count widening and item-index predicate change. New indexes are valid. Private helpers deny ordinary API execution; anonymous label RPC execution is denied. No persistent migration flag or authorization bypass exists.

The first file must execute atomically. It makes labels executable without creating a partial POS schema. Chaos commits and inventory edits remain compatible after each file. Production has no POS settings table before or after the two-file rehearsal; the application remains gated. On a full POS fixture, the separate test setup enables only local test workspaces to exercise sales; the migrations themselves never enable anything.

The application change introduces `label_access`; schema repair must precede its eventual application deployment, otherwise the API fails closed. Existing production already fails Label Studio, but the new code must not be presented as a deploy-first fix. No maintenance/execution window is approved while the workspace assignment gate remains unresolved. Local millisecond DDL timings do not predict production contention: ALTER TABLE/index changes acquire locks. Use bounded lock/statement timeouts and freshly reviewed counts before any eventual approved window.

## Validation

| Check | Result / scope |
| --- | --- |
| Root suite | 960 passed |
| Mobile suite | 580 passed |
| Root and mobile TypeScript | Passed |
| Root ESLint | 0 errors, 535 existing warnings |
| Mobile lint | 0 errors, 3 warnings |
| Production build | Passed |
| POS text ledger, 500 lines | 132 passed with Free-tier platform owner |
| POS enum ledger, 500 lines | 132 passed with Free-tier platform owner |
| POS/labels/payment browser workflows | 128 database checks plus browser workflows passed |
| Production-shaped two-file rehearsal | Preservation, Chaos, security and eligible synthetic-owner labels passed; real owner targets BLOCKED by missing workspace association |
| Label Studio component/renderer | Store printing passed; actual owner access passed but zero eligible real targets; eligible own synthetic exact-position issuance passed and was rolled back |
| Hosted security baseline | 15 real JWT/anonymous checks passed on isolated staging, unchanged deployed schema; **not hosted acceptance of these new migrations** |
| Secret audit | Passed: exact known staging privileged keys/passwords and secret-key patterns across changed files/static artifacts; not an exhaustive unknown-secret detector |
| Diff checks | Passed |

No new migrations were installed on a hosted project. Hosted repair/staff acceptance and final production-owner inventory acceptance remain pending the scope decision; existing staging baseline results cannot substitute for those gates. The local Label Studio browser uses the real component and renderer through a loopback SQL adapter, not hosted Next/Auth/PostgREST or physical hardware.

Reproduce: `node tests/production-schema-rehearsal.mjs --compatibility`, `node tests/pos-db.mjs --compatibility --large-cart`, `node tests/pos-db.mjs --compatibility --enum-ledger --large-cart`, `node tests/pos-db.mjs --compatibility --browser`. Sanitized captures/runtime stay ignored in `.local-fixtures`. Evidence: [production-compatibility-rehearsal.json](production-compatibility-rehearsal.json).

## Verification and disable strategy

Use [read-only verification queries](POS_PRODUCTION_COMPATIBILITY_VERIFICATION.sql) immediately before and after any future approved critical step. Stop on unexpected counts, owner associations, helper privileges, disabled RLS, changed collector guard, missing label targets, or any Chaos error. Snapshot comparisons and authenticated write probes belong in rehearsal, not an unapproved production transaction.

Keep POS and production Square disabled. On failure inside a future approved migration transaction, roll it back. After commit, retain schema and all financial/inventory history and prefer a reviewed forward correction; do not drop tables, delete/reinsert inventory, reset RLS, null identities or edit past migration history. Application rollback requires its own review because it may restore the known Label Studio failure.

## Completed writer/assignment follow-up

Current order: `20260921195747_label_production_compatibility.sql`, `20260921195836_chaos_and_pos_authority_compatibility.sql`, `20260921203415_inventory_authoritative_workspace_writer.sql`, then `20260921201424_inventory_workspace_assignment.sql`. The first three rewrite zero existing inventory values; the last changes only 1,489 workspace fields. This dependency order intentionally differs from filename timestamps; no historical file was edited.

The new private BEFORE triggers validate workspace at original INSERT time across Chaos, manual RPC, generic inventory persistence, imports and collection splits. Chaos batches carry validated operation context; candidate matching cannot merge inventory across workspaces. Creation events use actual inventory/batch scope. POS returns preserve existing owner/workspace, with no extra employee mutation grant. Explicit shared-store partner inventory stays supported without transferring its ownership. Personal non-workspace collector inventory remains nullable; a blanket NOT NULL was rejected.

The four-file production-shaped rehearsal now passes: 1,515 rows and 1,788 units preserved; all 1,489 assignments deterministic; zero unresolved/ambiguous; zero active workspace-backed rows missing scope. The collector guard and inventory RLS remain intact. Actual Label Studio component/renderer passes with 500 owner targets, and new manual/Chaos inventory receives labels. Browser tests use the documented local SQL adapter. Both POS ledgers pass 134 checks including 500-line carts, search/barcode and delegated sale/refund boundaries. Root tests: 960 passed. These new results supersede the historical empty-owner-target result above, not the explicit lack of hosted production acceptance.

**Final verdict: SAFE TO APPLY the reviewed four-file repair, pending owner approval.** Use the exact order, single-transaction maintenance boundary, verification queries and stop/rollback conditions in the [readiness report](POS_PRODUCTION_MIGRATION_READINESS.md). No merge, deployment, production SQL, POS enablement or Square configuration was performed.
