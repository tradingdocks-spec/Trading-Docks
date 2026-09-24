# Cloud Inventory Tenant-Isolation Audit

Status: **TENANCY HARDENING REQUIRED**. Audit performed 2026-09-24 UTC (2026-09-23 Arizona).

Production was queried using read-only transactions. No production rows, migrations, feature flags, browser storage, or credentials were changed. No deployment, merge, or repair application is authorized by this report. POS and production Square remain disabled. Physical certification is unchanged.

## Verified production baseline

| Measure | Observed |
|---|---:|
| Inventory records | 1,515 |
| Inventory units | 1,778 |
| Inventory records without workspace | 0 |
| Inventory orphan workspace references | 0 |
| Inventory events | 1,563 |
| Events with legacy NULL workspace | 1,534 |
| Chaos batches | 23 |
| Legacy committed batches with NULL workspace | 22 |
| Cloud draft albums | 1 |
| Cloud captures | 0 |
| Enabled POS workspaces | 0 |
| Square marketplace connections | 0 |

The live inventory is currently fully assigned. This does **not** establish workspace isolation for queries or mutations. A valid workspace FK alone does not enforce active workspace, membership, or delegation.

## Table inventory and scope

[Complete table/policy inventory](CLOUD_TENANT_TABLE_INVENTORY.md) covers 111 relevant public, private, and Storage tables, including exact RLS expressions, aggregate counts, direct workspace FK coverage, owner columns, and authenticated SELECT/INSERT/UPDATE grants. No raw customer rows or secret values are included.

- Inventory items have a nullable workspace FK; existing rows are complete. Owner ALL and member SELECT policies are permissive and do not require active workspace.
- Positions derive workspace through inventory and batch. They have owner policies, not a composite workspace boundary. The health query checks cross-parent consistency.
- Events retain 1,534 legacy NULL workspace values. They remain owner-readable, append-only through trusted paths; do not rewrite acquisition history during batch normalization.
- Locations, movements, legacy Chaos sessions/items/rules, marketplace orders/items, and several portfolio/link tables are owner/account scoped or parent scoped, without a direct workspace column. Owner scoping is not equivalent to the requested workspace isolation.
- New scan albums have a required workspace FK; captures inherit through album. Cloud command validation, album RLS, and Storage policy joins require the authenticated owner and active workspace.
- Labels/pricing use workspace FKs and RPC authorization. Some label table policies also independently permit workspace-member reads. Active-workspace restrictions are not uniformly enforced by those permissive policies.
- POS inventory references use required workspace IDs or parent sale/refund references and private authoritative functions. Installation has not enabled POS.
- Purchase/order/shipping/selling tables use a mixture of owner, workspace membership, and parent checks; nullable workspace columns currently contain no rows or no NULLs, but remain possible legacy exceptions.
- `tcgplayer_*` and global `tcgtracking_*` catalog/price tables intentionally represent shared product reference data rather than customer inventory. They should not be assigned invented tenant IDs.
- `chaos_scan_private.batch_counters` has RLS off but no browser table privileges and no browser schema access; it is trusted internal numbering state. All other tables in the catalog have RLS on. RLS-on is not, by itself, a security PASS.

## Findings requiring review

### 1. Active-workspace inventory isolation is missing

`src/lib/owned-inventory-query.ts` filters `inventory_items` by authenticated `user_id` and positive quantity, but has no workspace argument/filter. Both `loadWebCollectorCollectionPage` and global `searchOwnedInventory` reuse it. Detail lookup and related location/provenance lookups also use owner-only filters.

The isolated real database test created two workspaces owned by the same authenticated user, with one inventory row in each. While A was active, A2 remained readable; switching to A2 left A readable. This is reproducible without browser caches. Global search inherits exactly this boundary gap; the earlier bounded-provenance repair remains valid but did not implement active-workspace tenancy.

Unrelated B users could not read/update/remove A inventory in tested paths. A basic A member could read A inventory through the member policy but could not update/remove it and could not read the unrelated second workspace. Member SELECT is workspace-wide; it does not encode site-level employee inventory delegation. A separate membership/delegation contract must specify intended read access before changing it.

Additional real DB tests confirmed that, with A2 active, the same owner could update A's asking price and successfully call `remove_inventory_lot_quantity` for A (`quantityAfter: 2` from 3). Both probes were rolled back. A member also continued to read A after activating that member's own workspace. A seeded, nonempty A label identity remained readable to its owner with A2 active. These are active-workspace boundary failures, not evidence that an unrelated tenant can access arbitrary owners' data.

### 2. New-record enforcement is incomplete outside cloud Chaos

`inventory_private.resolve_workspace` validates canonical owner/manager membership, location ownership, and batch agreement. Cloud `chaos_scan_command` chooses the active workspace server-side and validates both canonical ownership and owner membership. A supplied foreign `workspaceId` did not override that choice. Forging an active preference does not satisfy the RPC ownership check.

However, inventory workspace remains nullable for supported personal/legacy paths; locations and movements have no workspace column, and several owner-scoped tables accept records without explicit workspace context. Current zero-NULL inventory is a verified data invariant, not a universal database constraint on every business record.

### 3. Browser/device persistence still needs bounded cleanup

The current Chaos workstation stores only history expansion and scanner configuration preferences in localStorage. Bridge IndexedDB holds workstation pairing material, not batch numbers, inventory quantities, or committed batch contents. Current cloud draft/capture/review/history identity is server-backed. Scan image responses use authenticated proxy downloads with `private, no-store`; no public scan URL is generated.

The active web Inventory route renders `CollectorWorkspace`, which uses cloud queries and does not load an inventory snapshot from localStorage. Older `InventoryWorkspace`/`TieredInventoryWorkspace` components still contain legacy local snapshot import/write code, but no imports of those components were found in the current source tree. Do not mistake those dead component paths for the active Inventory route; remove or quarantine them before reuse. `loadInventorySnapshot` itself remains used by Deck Vault and CSV conversion and is owner-only.

The active mobile `mobile/services/collector-data.ts` stores complete collection-card snapshots through `appStorage`, keyed only by user ID, and returns them as `stale: true` on failures. That is not a server write authority, but it does not meet the requested prohibition on device-held business data and is not workspace-scoped. `mobile/services/collector-workspace.ts` defines that user-only key. Deck Vault also keeps local recovery/deletion/pending-deck snapshots; these are not the inventory ledger, but require explicit scope and stale-state policy if business-critical linked state is covered by the new invariant.

POS command recovery keys and Label Studio's temporary selection tokens are request/recovery state; authoritative sale, quantity, pricing, identity, and authorization remain server validated. UI preference storage may stay. This audit did not read or clear a user's browser storage.

## Historical Chaos classification

Every legacy code **CS-000001 through CS-000022: DETERMINISTIC**. No ambiguous or unresolved case was found.

Each batch has nonempty positions, every position joins an existing same-owner inventory item with a non-NULL workspace, all joined items identify one workspace, that workspace's canonical owner matches the batch owner, and the destination belongs to that owner. The owner currently has exactly one owned workspace. Session-owner conflicts and explicit event-workspace conflicts both returned zero. The proposed migration additionally requires an owner membership, rejects conflicting session/event evidence, and rejects any album-backed or non-closed legacy candidate. It does not use active browser preference or guess from batch numbering.

Position-row counts by batch 1–22: `85, 71, 72, 45, 63, 65, 75, 83, 70, 36, 69, 73, 64, 66, 80, 76, 65, 31, 78, 74, 75, 72` (1,488 total). These are position rows, not original card/unit totals.

The existing cloud draft CS-000023 is unrelated to the legacy NULL-workspace problem. No historical batches 23–29 are created or inferred by this proposal.

## Proposed normalization — NOT APPLIED TO PRODUCTION

Prepared `supabase/migrations/20260924005111_chaos_legacy_workspace_normalization.sql` with the Supabase CLI.

Expected production effect: exactly 22 `chaos_sort_batches.workspace_id` values populated. No IDs, codes, owners, timestamps, quantities, positions, events, locations, or provenance change. No permanent function, policy, privilege, or trigger change.

The CLOSED-batch guard correctly rejects ordinary metadata rewrites. The migration takes an exclusive batch lock and share locks on supporting evidence tables, validates every NULL batch, builds a transaction-local evidence map, and temporarily refines the existing guard only for a trusted `postgres` session with no JWT actor and no SET ROLE. Only the exact evidence-backed NULL-to-workspace update is permitted, with every other column identical. It immediately restores the original function definition and verifies exact preservation before commit. No trigger is disabled, no ordinary role gains execution rights, and no persistent bypass flag/helper remains. Other sessions cannot see the temporary function definition before transaction completion; table locks also exclude competing mutations.

The migration stops atomically for unresolved evidence, a changed guard shape, unexpected row changes, lock timeout, or preservation failure. `lock_timeout=5s`; lock/runtime impact is small for 23 headers but supporting share locks temporarily block writes. Schedule an idle period after separate approval and rerun evidence immediately before execution. Do not deploy this pending migration through an automatic migration job.

Rehearsal used a fresh clone of the disconnected Supabase 17.6 recovery database after both cloud migrations. That base has the 22 historical batches; the production smoke draft was created later and is absent from the base. Synthetic cloud drafts and captures were created only in this isolated clone to test their authorization separately. Exact fingerprints proved preservation of all inventory, events, positions, non-workspace batch fields, RLS policies, and the restored guard definition. The health query returned zero findings after local normalization.

## Real database and regression tests

Run:

```text
node tests/cloud-tenant-audit-db.mjs
node tests/cloud-tenant-active-workspace-db.mjs
node tests/cloud-tenant-audit-db.mjs --normalization-only
```

These scripts refuse a network-connected recovery container and do not accept production connection URLs. They use real PostgreSQL role/JWT contexts, independent connections, and synthetic users in a new disposable database. The first script leaves its isolated fixture DB for the second; the second rolls mutations back. They intentionally return nonzero when the requested tenancy invariants fail. A red audit result is not relabelled PASS.

Initial audit: **35 assertions passed, 2 required active-workspace assertions failed**. Tests confirmed owner reads, member/outsider boundaries, denied outsider/member mutations, anonymous denial, server-chosen batch scope, cross-connection draft recovery, private scan bucket, scoped scan read/upload/capture, cross-active-workspace scan denial, label RPC denial, inaccessible barcode aliases, normalization preservation, and POS disabled.

Follow-up active-workspace audit: **9 passed, 5 failed**. Combined: **44 passed, 7 failed** across 51 assertions. Failures are the two owner read/switch cases plus inactive-workspace price update, quantity removal, global-search-equivalent owner/quantity query, member read after switching, and direct label identity read. Label identity testing first issued a real synthetic label target so the denial test could not pass merely because its table was empty. Four additional upload tests targeted valid, independently RESERVED object paths, not fabricated filenames: outsider, member, anonymous, and owner-in-inactive-workspace were all denied by RLS/grants. Barcode RPC/private-helper requests by unauthorized roles were denied; with POS disabled this does not constitute a positive enabled-POS barcode/delegation acceptance test.

Final migration-only rehearsal: **9/9 passed**, including failure on missing position evidence, rollback preservation after that failure, browser-role rejection, exact guard restoration, and healthy normalized relationships. This run includes the final session/event-conflict checks in the migration. It overlaps six preservation assertions in the broader audit, so its total should not be added as nine independent new security cases. During test development, an attempted membership-removal fixture was blocked by the existing platform-owner protection; the final negative fixture removes position evidence only inside a rolled-back disposable transaction.

Storage testing exercises actual `storage.objects` RLS and grants in the Supabase-compatible database, including owned upload/read and foreign/anonymous rejection. It does not claim a new hosted Storage HTTP/browser acceptance run. The browser API uses the same authenticated Supabase client, with no service-role proxy bypass. No production capture/upload was performed.

Root regression suite: **1,001 passed, 0 failed**. No runtime application code was changed. Full production deployment/build was not performed for this audit-only change. `git diff --check` passed.

## Integrity checks and proposed hardening order

`tests/cloud-tenant-integrity.sql` is read-only. It reports row/quantity totals, missing workspace IDs, orphan references, inventory owner/member relationship violations, mismatched position parents, and album/capture parent mismatches. Production must retain 1,515 inventory records, zero unscoped inventory, and zero orphan inventory workspace IDs. The 22 legacy NULL batches remain explicit findings until normalization is separately approved.

The final production run retained 1,515 rows / 1,778 units; all relationship/orphan checks returned zero. Only the known 22 NULL legacy batch workspace values remained. No production batch, event, or inventory repair was performed.

Recommended follow-up, subject to owner review:

1. Define one validated active-workspace access contract for owner inventory and explicitly permitted staff reads. Apply it to Inventory, global search, details, provenance, locations, mobile queries, labels, and all authoritative mutations. Active workspace selection is not authorization; always verify current membership/delegation independently.
2. Rehearse restrictive RLS plus RPC checks without destroying intended collector/partner ownership or site-scoped POS delegation. Permissive owner/member policies cannot be assumed to narrow each other.
3. Normalize only the 22 deterministic headers using the prepared migration. Keep event history unchanged.
4. Introduce reviewed workspace context for legacy location/session/order data, with explicit parent relationships. Add NOT NULL/composite consistency constraints only after classifying supported personal/legacy cases. Do not mass-assign by current active workspace.
5. Remove or quarantine legacy local inventory restoration paths; decide whether mobile read caches are prohibited entirely or may exist only as workspace-scoped, non-authoritative stale displays. The present requirement prohibits them.
6. Convert the adversarial audit failures into passing release gates and schedule the read-only integrity query as an operational check only if separately requested.

**Owner approval gate:** production normalization and broader tenancy hardening remain unapplied. The successful legacy-assignment rehearsal does not resolve the active-workspace security findings.
