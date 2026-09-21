# POS Phase 3 validation

Status: Implemented and locally validated for development. **Production rollout remains blocked.** Date: 2026-09-20. Branch: `codex/pos-foundation`.

Implementation commit: `01d158be497868df160b527bc8c0dab5430c59b8`.
Separate test-reliability commit: `9927eb7` (signature tampering now changes decoded bytes deterministically). Documentation follows in the commit containing this report. Accepted Phase 2 source: `fbf898190e895e923f6720157aa433d6c5c973c4`; pre-schema ownership audit: `d7cdaabc03258bf77b16b7d1f919c1c6c1d162e9`.

## Delivered behavior

Owner-controlled delegated employee checkout retains canonical inventory ownership and actual cashier identity. Multiple registers and owners share eligible site stock with authoritative authorization and stock locks. Register sessions record opening float, cash activity, counted closing and variance; closing blocks new sales. Refunds can return partial quantities with an explicit stock decision. Discounts/overrides preserve originals, manager approvals record a separate authenticated approver, and receipts/history/session/daily views explain the resulting sale and drawer totals.

See [register operations](POS_REGISTER_OPERATIONS.md) for the complete authorization, money, state-machine and recovery contract, and [architecture](POS_ARCHITECTURE.md) for integration with the accepted phases.

## Additive database changes

Only two new migration files were authored:

- `20260920201259_pos_staff_delegation.sql`
- `20260920201754_pos_register_operations.sql`

No applied migration was edited. Neither new migration was applied to hosted Supabase.

New public tables: `pos_inventory_delegations`, `pos_access_events`, `pos_cash_events`, `pos_operation_receipts`, `pos_approval_requests`, `pos_approval_decisions`, `pos_refunds`, `pos_refund_items`. Private tables: `pos_private.stock_permits`, `pos_private.approval_uses`. Existing sites gain timezone/settings; registers gain active/configuration fields; sessions gain explicit state, opening/count/expected/variance/closing attribution.

New private helpers: `permission`, `can_transact`, `lock_authority`, `permitted_stock_update`, `access_command`, `resolve_owner_barcode`, `session_transition`, `refund`, `delegation_history`, `expected_cash`, `site_access`, `approved`, `record_sale_cash`, `operations`, `read_operations`, `protect_refund_event`, `calculate`. Forward replacements: `authorize`, `resolve_barcode`, `cash_command`, `protect_event_origin`, `command`, and the canonical public `enforce_collector_inventory_mutation` guard. Existing public POS RPC remains the narrow authenticated entry point.

All new tables enable RLS and revoke direct anonymous/authenticated writes and reads; access goes through scoped commands. Private helpers revoke PUBLIC execution. Immutable records and constrained session/delegation transitions are enforced in SQL. Indices cover active employee/site grants, cash/session history, receipt/SKU prefix and product text search, refunds and reporting.

## Permissions, sites and concurrency

Canonical inventory ownership is unchanged. Employee role normalization permits POS entry while retaining all other entitlement/admin boundaries. Database authority requires POS capability plus ownership or explicit live owner/site delegation, eligible mapped storage, paid stock-owner entitlement and valid session. Membership, manager role or cart presence alone grants no foreign stock access. Refund capability and return delegation are separately required. Label administration is not inherited.

Owner grants/revokes retain immutable scope history and attributable audit events. Shared owner advisory locks serialize delegation changes with finalization; authorization is rechecked after acquiring the lock. Existing parent/position/reservation locking remains in place. Private permits authorize only an exact old row and prescribed stock change by the actual actor in the current database transaction. No impersonation or service-role shortcut was introduced.

Sessions transition OPEN → CLOSING → CLOSED, with manager-only resume before close. Closed sessions reject new transactions. Immutable operation receipts bind actor/key to exact intent, so retries cannot duplicate cash or stock. Approvals bind exact operation and authoritative pricing/cash summary to a different authenticated manager. Refunds serialize against their processing session and original sale and cannot exceed original quantities or monetary allocations.

## Validation results

Required pre-runtime checks were completed before implementation: root TypeScript/build, lint (0 errors, 534 warnings), 906 unit tests; active mobile TypeScript, lint (0 errors, 3 warnings), 580 tests.

| Final check | Result |
| --- | --- |
| Root TypeScript | Passed. |
| Root ESLint | Passed: 0 errors, 534 existing warnings; no increase from baseline. Focused POS lint is clean. |
| Root unit tests | 912/912 passed, none skipped. |
| Next production build | Passed, including all new POS routes. |
| Active mobile TypeScript / lint | Passed; lint 0 errors, 3 existing warnings. |
| Active mobile unit tests | 580/580 passed. |
| Expo Web export | Passed. |
| Expo Android and iOS bundle exports | Passed; not native binary/device acceptance. |
| Database text-ledger fixture | 79 check groups passed. |
| Database enum-ledger fixture | 79 check groups passed. |
| Integrated local SQL/browser suite | Passed 79 database groups plus label workflow, three existing POS browser groups and three operational browser groups. |
| Receipt PDF rendering | Six groups passed: 58mm, 80mm, Letter with 1 and 25 items; thermal one continuous page, Letter 1/3 pages; no internal IDs or horizontal overflow. |
| Label PDF regression | Nine groups passed, roll quantities through 500 and Letter sheets; all six preset previews generated. |
| Chaos Sort print regression | 30 Chrome/Edge checks passed. |
| Local Supabase security advisors | Five pre-existing/fixture mutable-search-path warnings; no new Phase 3 findings. |
| Whitespace / migration scope | Passed; no changes to prior migrations, secrets or environment files. |

The first final unit run exposed a pre-existing flaky capture-signature test: replacing the final base64url character can leave decoded signature bytes unchanged. A separate test-only commit changes significant signature bits. The subsequent full run passed 912/912. No production signature implementation was changed.

Advisor warnings name `current_admin_role`, `is_admin`, `workspace_role_rank`, `collector_inventory_error_payload`, `raise_collector_inventory_error`. They are not waived production acceptance. The advisor CLI used a loopback URL, despite its generic “remote database” connection banner.

## Executable boundary and money coverage

`tests/pos-staffing-boundary.mjs` retains the audit regression: owner succeeds; ungranted employee and workspace manager fail; canonical direct foreign-owner mutation fails even independently of RLS. Expanded checks prove separate checkout permission, owner/site grant scope, revocation of existing carts, wrong-site scan/search/checkout denial, exact-position barcode authorization, grant history and actor attribution, self-grant/private-permit/direct-write denial, and a revocation-wins race synchronized on PostgreSQL lock waiting. Existing cross-workspace and anonymous boundary checks remain in the harness.

`tests/pos-operations-db.mjs` covers duplicate/concurrent opens; immutable opening and sale cash; exact applied cash/change; duplicate movements; paid-in/out/drop/adjustment; duplicate and partial refunds; restock/no-restock; cumulative tax conservation; fixed/percentage/cart discounts and overrides; CLOSING rejection and manager resume; notes and concurrent close; new shifts and sale/close races; daily/session queries; direct table denial; two canonical owners in one sale; separate actual manager decision and exact intent; changed original price invalidating approval despite a fixed override; independent refund permissions; expired/revoked grants; changed-condition restock rollback; refund/close races; blind-count variance approval.

`tests/pos-pricing.test.ts` adds deterministic allocation, mixed-case database ordering, invalid combinations, override/discount/tax and the 33578-minor-unit drawer example. Root regressions include Inventory, Orders, marketplace/reservation, labels, navigation and shared access tests.

## Browser and print evidence

Production React components are bundled into the existing isolated browser harness and call the real migrated loopback PostgreSQL commands through test adapters. Separate browser contexts use separate authenticated SQL clients for cashier and manager. Covered flow: opening float → paid in → cash sale → explicit restock refund → counted close; denied cashier discount → independent manager approval → original cashier sale; daily report and tablet layout. Existing label selection/printing/exact scan, checkout, lost-response recovery and explicit New Sale checks pass. No page errors were observed. Desktop/tablet register, operations and daily screenshots were visually inspected.

This does **not** claim hosted Supabase authentication, invitation, cookie/RLS integration or complete Next HTTP transport E2E. API unit tests and Next compilation validate the route boundary separately. Browser PDF checks establish generated document geometry, not actual printer output.

Local ignored evidence is under `.local-fixtures/phase3-final-*.log`, `.local-fixtures/phase3-mobile-*.log`, `.local-fixtures/phase3-expo-*.log`, `.local-fixtures/pos-db/`, `.local-fixtures/pos-receipts/` and label/Chaos print artifacts. It contains disposable test data and is not committed.

## Files changed

Implementation commit:

```text
mobile/services/platform-access.ts
package.json
src/app/api/pos/route.ts
src/app/dashboard/pos/layout.tsx
src/app/dashboard/pos/pos.css
src/app/dashboard/pos/registers/page.tsx
src/app/dashboard/pos/reports/daily/page.tsx
src/app/dashboard/pos/staff/page.tsx
src/app/dashboard/pos/transactions/[saleId]/page.tsx
src/app/dashboard/pos/transactions/[saleId]/receipt/route.ts
src/app/dashboard/pos/transactions/page.tsx
src/components/dashboard/navigation.ts
src/components/pos/MoneyInput.tsx
src/components/pos/OperationalCommand.tsx
src/components/pos/Operations.tsx
src/components/pos/OperationsPage.tsx
src/components/pos/PosSetup.tsx
src/components/pos/RefundPanel.tsx
src/components/pos/Register.tsx
src/components/pos/ShiftControls.tsx
src/lib/pos/domain.ts
src/lib/pos/pricing.ts
src/lib/pos/receipt.ts
supabase/migrations/20260920201259_pos_staff_delegation.sql
supabase/migrations/20260920201754_pos_register_operations.sql
tests/fixtures/pos-prerequisites.sql
tests/label-workflow-browser.mjs
tests/platform-access.test.ts
tests/pos-browser.mjs
tests/pos-db.mjs
tests/pos-operations-browser.mjs
tests/pos-operations-db.mjs
tests/pos-pricing.test.ts
tests/pos-receipt-browser.mjs
tests/pos-staffing-boundary.mjs
```

Additional files: `tests/marketing-intelligence.test.ts` in the separate test-reliability commit; `docs/POS_ARCHITECTURE.md`, `docs/POS_REGISTER_OPERATIONS.md`, and this validation report in the documentation commit. No dependency or lockfile changes.

## Known limits and production status

Development completion does not authorize deployment. No production migration, rollout enablement, payment connection, deployment, push or main merge was performed.

Hosted auth/RLS and employee invitation/account-switching acceptance, clean replay against actual production prerequisites, and physical scanner/printer/cash-drawer QA remain mandatory separate gates. Android/iOS exports verify JavaScript bundles, not signed binaries or installed hardware. Register functionality remains web-based.

Latest session history is bounded to 200 entries. Reporting uses site-local calendar days with no custom business-day cutoff; broader analytics aggregation remains future integration through the stable query layer. Register name/description/hardware preferences are supported by the command schema; the current UI offers register creation and activation controls. No PIN fast-switch, held carts, dedicated keyboard shortcut suite, email transport, offline/card/split-tender processing or live processor is delivered. These do not silently substitute for authenticated authorization.

Legacy opening float is unknown/zero. Legacy sale snapshots without an inventory-value basis reject automatic restock and require separately authorized inventory review after a no-restock refund. Historical receipts remain immutable. Future card payments authorized before delegation revocation need explicit persisted payment/reservation recovery; Phase 3 atomic cash does not implement that future state machine.
