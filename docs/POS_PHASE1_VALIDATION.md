# POS Phase 1 implementation and validation

Date: 2026-09-20. Branch: `codex/pos-foundation`.

Status: Implemented in source and verified with a disposable local PostgreSQL database. Hosted deployment is **Requires Production Configuration**. This is not a production rollout certification.

## Delivered behavior

The gated POS navigation opens a dedicated cash register. Managers configure a store site, map an existing inventory storage location and enter an explicit tax rate, then create/open a register. Search resolves real owned inventory, stable Label Studio SKUs/QR tokens, legacy SKUs, UPC/barcode values, printing fields, location names and batch codes. Repeated keyboard-wedge scans increment a cart line. Editable fields are excluded from global scanner capture. Unknown/ambiguous scans do not silently select stock.

Cart supports whole quantities, removal, explicit physical position selection, manager-only percentage discounts with reason and price/availability refresh. Tax-exclusive USD totals use asking prices and integer minor units. Missing prices block sales; zero must be explicitly recorded. Non-taxable inventory uses canonical `data.taxable=false`. Cash received/change are recorded separately. Location tax and prices are re-read inside checkout; a changed total rejects the request before any sale commits.

Finalization creates immutable sale/line/allocation/tender/receipt snapshots and canonical inventory events in one transaction. It decrements the exact item/physical positions and batch current quantities while respecting marketplace reservations. Retry with the same key returns the same sale; changed intent is rejected. Checkout intent is stored locally under workspace/user before sending, and an uncertain result locks editing until the original checkout is recovered or retried. No offline sales or mock production inventory are provided.

History shows the operator's completed sales in the selected workspace; transaction detail and an isolated printable receipt preserve historical prices/names. Register sessions carry actor, site, register and open/close timestamps. Full cash drawer accounting remains Phase 3.

## Ownership and permissions

**Owner-operated stock boundary is intentional.** Existing `enforce_collector_inventory_mutation` rejects mutations where `auth.uid()` differs from inventory owner. This release preserves that rule. Workspace membership alone does not allow an employee to sell another user's inventory. Each configured site binds storage owned by its configuring operator. Actor attribution is implemented; shared employee-operated store stock is not advertised as implemented.

The HTTP boundary reuses `requireApiCapability('pos.sell')` and server-resolved active workspace. The database independently verifies membership, role, effective paid tier, suspension, employee active status when present, rollout and inventory ownership. Managers/owners configure locations and apply discounts; members may perform authorized cash operations on their own site stock. Existing `pos.sell` remains compatible with Seller/Store entitlement; the rollout setting determines participating workspaces and has no self-service enable operation.

All ten new public tables enable RLS and revoke anonymous/authenticated table privileges. Reads and writes use the narrowly exposed `pos_command` RPC. Its private implementation uses fixed search paths, explicit tenant predicates and authenticated actor checks. No service-role client is used. Private helpers are not executable by API roles. Completed sale records, tenders, allocations and POS events cannot be updated/deleted. Existing generic inventory policies are not broadened.

Mutating HTTP requests enforce same origin and a streamed 32 KiB body limit. Read/write actions are explicitly allowlisted. Responses disable caching. SQL exceptions map to safe user messages; logs contain action/error code only. Database counters bound successful search/command traffic to 600 per minute per actor/bucket; failed SQL transactions roll back their counters. Receipts escape stored names and use a restrictive CSP.

## Schema and inventory changes

Additive migration: `supabase/migrations/20260920181448_pos_cash_foundation.sql`.

New public tables:

- `pos_workspace_settings`: disabled-by-default workspace rollout.
- `pos_store_locations`: site, stock owner, tax basis points and USD currency.
- `pos_location_inventory_locations`: explicit site-to-existing-storage mapping.
- `pos_registers` and `pos_register_sessions`: site/register and operator lifecycle.
- `pos_checkout_cancellations`: immutable canceled intents; delayed requests cannot resurrect them.
- `pos_sales`: immutable financial snapshot, request/idempotency identity and receipt JSON.
- `pos_sale_items`: immutable printing/price/tax/discount snapshots.
- `pos_sale_allocations`: exact item/position/batch/location deductions.
- `pos_tenders`: one-to-many cash tenders, applied/received/change amounts and recorded verification class.

New private table: `pos_private.request_limits` (RLS enabled, no client access).

New functions: `public.pos_command`; private `authorize`, `command`, `check_stock`, `immutable`, `protect_event_origin`, `cost_snapshot`. Public `reserve_selling_inventory` is replaced forward-only to acquire the existing collector owner advisory lock and canonical item lock before candidate/position locks. Its existing external signature and reservation semantics are retained.

New deferred constraint triggers check item/position/reservation totals for every writer, including direct authorized Data API writes. Active reservations are counted across workspace labels for the same physical owner/item, preventing duplicate assignment of the same stock under different workspace references. Parent row locking serializes checks. New indexes support owner/item reservations, physical positions, immutable sale children, history and inventory text search. Existing inconsistent positions/reservations will be rejected when touched; staging must assess those rows before rollout.

Reused primitives: `inventory_items`, `inventory_locations`, `inventory_events`, `chaos_sort_inventory_positions`, `chaos_sort_batches`, `selling_inventory_allocations`, existing marketplace reservation RPC, workspace membership, employee linkage, membership resolver and Label Studio identity generation.

### Ledger compatibility

The August ledger uses enum columns and an append-only trigger; September's `CREATE TABLE IF NOT EXISTS` uses text declarations but does not convert a preexisting table. This migration does not rewrite either historical migration or force a destructive type conversion. It emits existing `quantity_removed` / `system` values, with `related_entity_type='pos_sale'`, sale ID, actor/site/register/receipt and exact allocations in metadata. These values work with both ledger definitions. POS-specific immutable/origin guards work alongside the older append-only guard.

Cost fields are retained as explicitly named minor-unit snapshots from known legacy unit/total acquisition keys. Existing acquisition metadata and source links remain canonical; the release does not guess unit cost from ambiguous legacy totals or claim profitability reporting. Refunds and cost recognition remain later phases.

## Actual routes and accepted-design refinements

- `/dashboard/pos`: register.
- `/dashboard/pos/setup`: site/storage/tax/register setup.
- `/dashboard/pos/transactions`: operator-scoped history, 50-row composite timestamp/ID pagination.
- `/dashboard/pos/transactions/[saleId]`: immutable detail.
- `/dashboard/pos/transactions/[saleId]/receipt`: authenticated standalone print document.
- `/api/pos`: explicitly allowlisted GET read operations and POST setup/session/checkout operations.

The accepted conceptual endpoints are consolidated into one typed client adapter and one authenticated API handler, matching the existing Label Studio action convention. The database transaction remains in one private command implementation.

There is no separate draft/cart table or receipt table in Phase 1: completed idempotency intent and receipt JSON live atomically on `pos_sales`; pre-completion recovery keeps the exact pending request in user/workspace-scoped browser storage. Nothing is recorded as completed before the transaction commits. Canceling an uncertain checkout acquires the same idempotency lock: it returns an existing completed sale or records an immutable cancellation that blocks delayed requests. One-to-many tenders and immutable allocation rows preserve future provider/refund extension points. No Square adapter, merchant credential, terminal or production mock provider is introduced.

Label generation/designer changes remain Phase 2. Existing stable SKUs/QRs are resolved; this release does not claim globally unique legacy SKU strings or position-specific labels. Position selection is explicit in the cart. Discounts initially support manager-approved whole-percent line discounts, not cart-dollar discounts or cashier override policies. USD exclusive tax only. Setup maps one existing storage location per newly created site; multi-storage management is a follow-up. No fake data is available through product routes.

## Validation evidence

| Check | Result |
| --- | --- |
| TypeScript | Passed `npm run typecheck`. |
| ESLint | Root lint passed with no errors and 537 existing warnings. Focused POS lint passed without warnings. Generated local fixtures are excluded. |
| Unit/API/regression suite | Latest run: 889/890 passed; the same pre-existing intermittent marketing capture-token assertion failed. All 12 new POS tests passed, including real execution of API body/origin/error handling, money, scanner, cart and receipt tests, plus existing Inventory/Orders/Chaos Sort/platform tests. |
| Native Postgres integration | 29 checks per ledger variant, using PostgreSQL 17.10, independent connections and authenticated/anonymous roles. |
| Ledger compatibility | Both actual August enum-ledger and September text-ledger migrations applied in separate disposable clusters with relevant actual Label Studio/Chaos Sort/Selling prerequisites. |
| Browser/data flow | Three grouped browser checks passed in installed Chrome using the production Register and receipt renderer, loopback HTTP adapter and actual Postgres command. |
| Production build | `npm run build` passed; POS pages/API appear in the Next.js route output. |
| Diff hygiene | `git diff --check` required before commit. |

The database checks cover final-copy checkout races, marketplace reservation races, identical simultaneous checkout keys, changed-payload replay, exact-position/no-fallback behavior, batch totals, late-failure rollback, forged totals, missing prices, non-taxable items, insufficient cash, discount authority/reason, direct table/helper denial, anonymous/cross-tenant/viewer denial, suspended/inactive operators, session close, immutable receipts/events, stable SKU repricing, cancellation/delayed retries, history cursors and disabled-rollout recovery.

Browser checks cover open register, global scans twice, editable quantity input, cash/change, receipt PDF, unknown scan, manual search, response-loss simulation after commit followed by reload/recovery, tablet overflow, register close and no page errors. Evidence is generated under ignored `.local-fixtures/pos-db/` (`register-desktop.png`, `register-tablet.png`, `receipt.pdf`). Fixtures exist only in tests.

The browser HTTP adapter replaces Next/Supabase session transport; it does not certify hosted session cookies or PostgREST configuration. Unit/API tests execute production route handlers with controlled service dependencies. Database tests execute production SQL with Supabase auth/role prerequisites supplied by the local fixture. This is meaningful database concurrency/RLS verification, **not** full hosted Supabase migration replay.

Initial baseline was 877/878 due to an unrelated marketing capture-token assertion. An intermediate full suite passed 884/884; the final 890-test run reproduced that one baseline failure. It remains an unresolved pre-existing test failure and was not changed to make POS checks green.

### Reproduce locally

The test runtime is deliberately outside production dependencies. Install pinned tooling into the ignored fixture directory:

```powershell
npm install --prefix .local-fixtures/pos-db --no-audit --no-fund embedded-postgres@17.10.0-beta.17 pg@8.16.3 esbuild@0.25.10
npm run test:pos:db
npm run test:pos:browser
npm test
npm run typecheck
npm run lint
npm run build
git diff --check
```

The harness creates a uniquely named local cluster, binds only `127.0.0.1:55439`, supplies synthetic auth/inventory fixtures and stops Postgres afterward. It never reads app environment files or accepts a remote database URL. Test clusters are retained for diagnosis under the ignored fixture directory. Chrome must be installed for browser checks. No Docker or production credentials are required.

## Staging prerequisites and remaining risks

Requires Production Configuration:

1. Replay the complete repository migration chain in an explicitly approved disposable Supabase project; the local harness covers the POS dependency subset, not unrelated historical CRM/billing migrations. Inspect actual grants, RLS policies and triggers with advisors.
2. Verify existing inventory workspace assignments, location mappings, asking prices and legacy SKU conflicts. Audit sum(position quantities) and active allocations versus item quantity, plus batch counters. Correct inconsistent stock through existing audited workflows rather than bypassing guards.
3. Apply this additive migration in staging. Use a reviewed admin/database operation to insert `pos_workspace_settings(workspace_id,enabled)` for the staging workspace; no product API can turn it on. Confirm the actual owner has membership and accessible owned inventory, then complete real authenticated Next/Supabase checkout/recovery and cross-tenant QA.
4. Exercise physical USB/Bluetooth scanners and OS receipt printer settings. The print route uses 80 × 200 mm pages with pagination for long receipts; select matching driver media, scale and margins. Automated PDF output is not physical printer certification.
5. Review shared stock guard effects on all deployed inventory writers. Consistent RPC lock ordering prevents the principal POS/reservation race; arbitrary legacy multi-row writers can still deadlock and require safe retry. Never disable constraints to avoid that review.

Further limitations: operator-owned transaction visibility; no shared employee stock, refunds UI, drawer reconciliation, offline completion, cart-dollar discounts, customer attachment or Square. Pending checkout recovery is browser-local; clearing browser storage requires transaction-history review before re-entering a sale. Legacy cost-basis interpretation remains reporting follow-up.

Rollback/disable: set the workspace rollout off through the reviewed administration path. New setup/search/checkout stops; authorized receipt/history/recovery reads remain. Preserve immutable sales and ledger rows. Do not drop tables, reverse quantities blindly or rewrite applied migrations.

Phase 2 decision: ready for continued isolated label-development work after review of this source slice; the pre-existing marketing token failure remains a repository quality issue. Production rollout remains blocked on the staging and hardware gates above; shared employee operation needs a separately reviewed ownership extension.
