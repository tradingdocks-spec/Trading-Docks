# POS Phase 4 validation

Status: Implemented and locally validated for development. **Production remains blocked.** Date: 2026-09-20. Branch: `codex/pos-foundation`.

Implementation commit: `8233df25859e1c4ea428d26447e0c92758c76dcc`. Documentation is in the subsequent commit containing this report. Accepted Phase 3 source: `01d158b`; accepted Phase 3 documentation: `4fc4d48`.

## Delivered scope

Provider-neutral interfaces and capability flags, immutable checkout financial snapshots, persisted payment/refund attempts, explicit state transitions, deterministic MOCK and explicitly unverified EXTERNAL adapters, idempotent initiation/finalization, event deduplication, reconciliation and successful-payment/local-finalization recovery are implemented. CASH retains its accepted synchronous flow. Register payment selection, locked uncertain-payment state, reload recovery, original-provider refunds, payment history/status filters and safe receipt metadata are connected.

[Payment architecture](POS_PAYMENT_ARCHITECTURE.md) records the pre-code audit, reuse decisions, complete state tables, adapter contract, security boundaries, routes, simulator behavior, refund flow and future real-provider requirements. [POS architecture](POS_ARCHITECTURE.md) links the Phase 4 implementation.

## Database changes

New additive migration: `supabase/migrations/20260920211929_pos_payment_framework.sql`. No Phase 1, 2, 3 or other applied migration was modified. No hosted database migration was applied.

New public tables:

- `pos_payment_checkouts`: immutable financial intent/snapshot, site/register/session/actor and separate sale-completion state.
- `pos_payment_attempts`: provider, amount/currency, provider reference, actor/key binding, status and reconciliation timestamps.
- `pos_payment_refund_attempts`: independent refund identity, immutable intent, cumulative amount and separate provider/local-completion state.
- `pos_payment_events`: scoped external-event deduplication and normalized processing state.
- `pos_payment_audit`: immutable attributable lifecycle events.

Private tables: `payment_test_config` (disabled by default), `mock_payments`, `mock_refunds`, `payment_context`. All new public/private tables enable RLS and revoke direct client access. Scoped authenticated wrappers are the only ordinary mutation/read boundary.

Existing `pos_tenders` accepts cash/mock/external methods with explicit recorded/simulated/externally-recorded verification and optional attempt/reference/safe metadata. The sale-to-many-tenders shape remains intact. Cash ledger triggers now ignore noncash tenders. The existing canonical sale/refund functions are forward-replaced only to consume a private successful-payment context, retain snapshot consistency, prevent cash refunds of noncash sales and avoid noncash drawer entries. Historical sales/tenders/receipts remain immutable.

New private functions: `payment_transition`, `payment_authorize`, `payment_view`, `payment_audit`, `payment_close_guard`, `payment_validate_stock`, `payment_command`, `payment_refund_quote`, `payment_refund_command`. New public wrappers: `pos_payment_command`, `pos_payment_refund_command`. Forward replacements: `cash_command`, `record_sale_cash`, `refund`, `read_operations`.

Indices cover active-attempt uniqueness, actor/idempotency keys, checkout/session state, provider references, refund capacity, pending refund/session checks, events and audit. No dependency, package-lock, secret or environment changes were required.

## State and money guarantees

Payment state and checkout/sale state are separate. A successful provider operation is committed before local sale/stock/receipt finalization. A failed finalizer leaves SUCCEEDED + RECOVERY_REQUIRED rather than losing payment evidence. Retrying finalization uses the same checkout key. A manager may refund an unfulfillable successful payment without creating a sale or returning nonexistent sold stock.

Definitive decline/failure/cancel returns a checkout to PAYABLE and retains the old attempt. UNKNOWN and TIMED_OUT remain uncertain and block unsafe new attempts. COMPLETED and VOIDED checkout states are terminal. Invalid attempt transitions and immutable financial changes are rejected in SQL. The full transition matrix is in the architecture document.

Amounts come from authoritative integer SQL pricing and immutable original refund lines. The browser cannot choose the charged amount by supplying an arbitrary provider status or amount. Exact-position/parent/reservation availability is checked before dispatch and at finalization. Delegation is revalidated; no employee becomes the inventory owner. Original authenticated cashier identity remains on the sale.

Idempotency has independent boundaries for initiation, provider operation, event identity, local finalization and refund initiation. Same key plus changed intent fails. One active attempt per checkout and one unresolved refund per attempt prevent overlapping financial commitments. Multiple definitive attempts on the same checkout retain their history. Noncash operations never create cash-sale/refund ledger entries.

A close competing with payment initiation/finalization uses the session lock. Pending payment or refund recovery blocks closing; a completed payment can safely precede close. Disabling rollout rejects first provider dispatch of an unpaid CREATED attempt while preserving safe unpaid cancellation and historical reconciliation.

## Provider and environment behavior

MOCK supports APPROVE, DECLINE, CANCEL, TIMEOUT, DELAYED_SUCCESS, UNKNOWN_THEN_SUCCESS, UNKNOWN_THEN_DECLINE, REFUND_SUCCESS, REFUND_FAIL and an uncertain-refund recovery scenario. Outcomes and retrieval progression are deterministic. A private persisted provider ledger survives reload; it is separate from local sale finalization transactions.

The database defaults MOCK off. Only the disposable test harness enables it. The adapter rejects production/unspecified environments before persistence/provider calls, server capability output suppresses it, and production client controls omit Mock Card. No live account or terminal is connected. EXTERNAL is explicitly “Externally recorded”; an external refund records money already returned elsewhere and does not imply processor verification.

Provider account/location/device types and optional capabilities prepare later adapters without secrets or connection settings. Webhook ingestion requires an adapter's real raw-body verifier before authoritative retrieval. MOCK has no verifier and cannot masquerade as a secure public webhook. Internal test events read the private provider ledger; supplied browser statuses are ignored.

Normalized error categories and safe merchant messages cover transport failures, unknown status, decline, account/device/configuration problems and refund failure. Structured logs use identifiers/state/category, not raw provider/card payloads. Receipt rendering includes only safe brand/last4 data when present; cash/manual tenders never invent card data.

## Validation performed

Pre-runtime baselines passed: root TypeScript/build, 912 tests, ESLint 0 errors/534 warnings; active mobile TypeScript, 580 tests, ESLint 0 errors/3 warnings. Final results:

| Check | Result |
| --- | --- |
| Root TypeScript | Passed. |
| Root ESLint | 0 errors, 534 existing warnings; focused changed payment/POS files clean. |
| Root unit/regression suite | 920/920 passed, none skipped. Includes eight new payment domain/security tests. |
| Next production build | Passed with all new payment routes/pages. |
| Text-ledger database fixture | 97 check groups passed. |
| Enum-ledger database fixture | 97 check groups passed. |
| Local browser + SQL integration | 97 database groups plus existing label/cash/register flows and seven new payment browser groups passed. |
| Receipt PDFs | 12 combinations passed: CASH/MOCK × 58mm/80mm/Letter × 1/25 lines; correct width/page counts, safe metadata, no internal IDs or horizontal overflow. |
| Label print regression | Nine PDF groups passed, through 500 roll labels, plus six preset previews. |
| Chaos Sort printing | 30 Chrome/Edge checks passed. |
| Active mobile TypeScript / lint | Passed; 0 lint errors, 3 pre-existing warnings. |
| Active mobile tests | 580/580 passed. |
| Expo Web export | Passed. |
| Expo Android/iOS exports | Passed; JavaScript bundle exports, not signed binary/device acceptance. |
| Local Supabase security advisors | Five existing prerequisite/fixture mutable-search-path warnings; no new Phase 4 finding. |
| `git diff --check` | Passed. |

Existing advisor warnings name `current_admin_role`, `is_admin`, `workspace_role_rank`, `collector_inventory_error_payload`, `raise_collector_inventory_error`. The CLI's generic “remote database” banner refers to the supplied loopback URL; no hosted database connection was used.

## Database and provider contract evidence

`tests/pos-payments-db.mjs` adds 18 groups to the accepted 79-check suite:

1. MOCK disabled by default at database authority.
2. Concurrent same-key initiation returns one immutable attempt; changed intent and a second active attempt fail.
3. Provider success persists before concurrent finalization; one sale, one tender, one stock deduction, no drawer cash effect.
4. Decline/cancel/timeout create no sale; unresolved timeout blocks close.
5. Unknown-success, unknown-decline and delayed-success reconcile deterministically.
6. Changed pricing retains successful payment/recovery and blocks a second charge; restoring valid state allows one completion.
7. Provider refund retries create one partial refund; cash refund bypass is denied and cumulative ceilings hold.
8. Unknown refund reconciliation completes once and restocks only explicitly chosen inventory.
9. External tender is explicitly unverified and does not affect cash.
10. Other-tenant/direct-table/private-provider access is denied.
11. Real orchestrator/provider contract covers create/replay/retrieve/cancel/refund failure without duplicate operations.
12. Successful unfulfillable payment can be refunded and voided with no sale.
13. Browser status injection is ignored; invalid database transitions, snapshot edits and anonymous RPC execution fail.
14. Unknown exact position fails before provider contact.
15. Delegation revoked after provider success blocks stock, preserves payment and permits authorized manager recovery refund.
16. A declined checkout preserves attempt history when a later attempt succeeds.
17. Provider success versus drawer close serializes without an orphan payment/sale.
18. Rollout disable prevents first dispatch while unpaid cancellation remains safe.

The suite exercises independent SQL connections for duplicate initiation, duplicate observation/event handling, finalizer races, refund completion/reconciliation and close races. It replays both supported inventory event ledger schemas. Existing Phase 1–3 authorization, canonical mutation, reservations, barcodes, label identity, cash math, approvals, returns and session checks remain passing.

Domain tests cover terminal-state transitions, integer multi-tender math, sensitive metadata removal, production MOCK rejection before any provider call, rejection of unsigned mock webhooks, normalized safe errors and printable mock tender metadata. No raw card input or credentials are used.

## Browser evidence

Production components run against the migrated loopback database through a test HTTP adapter using the actual `PaymentOrchestrator` and provider adapters. New groups cover:

- Approved mock checkout → Payment Complete and one sale.
- Decline/cancel → preserved cart and explicit permission to choose another method.
- Timeout/unknown/delayed success → locked cart, no duplicate Pay, explicit status check/cancel.
- Provider success with deliberately lost response → reload → same-key recovery → no second sale.
- Mock partial refund with deliberately lost response → reload/retry → one refund.
- Payment method and status filters after partial refund.
- Tablet layout and no page errors.

Desktop completion and tablet uncertainty screenshots were visually inspected. Receipt PDF checks also inspected safe mock tender output. Cash/regression browser flows continue to pass after adding provider controls. Browser fixtures for legacy cash/label flows explicitly report MOCK unavailable; payment tests use the development/test adapter with separate persisted SQL provider state.

This is not a claim of hosted Supabase login/invitation/cookie behavior or a full Next HTTP/auth middleware end-to-end test. The fixture adapter supplies isolated authenticated SQL clients; TypeScript/build and source boundary review cover the Next resource handlers separately. Real webhook signatures and external processor transport are intentionally not tested because no real adapter exists yet.

Ignored local evidence: `.local-fixtures/phase4-*.log`, `.local-fixtures/pos-db/payment-complete.png`, `.local-fixtures/pos-db/payment-unknown-tablet.png`, `.local-fixtures/pos-receipts/{CASH,MOCK}-*.pdf`, and existing label/Chaos artifacts. These are disposable test artifacts and are not committed.

## Files changed

Implementation commit:

```text
src/app/api/pos/payments/[id]/cancel/route.ts
src/app/api/pos/payments/[id]/check/route.ts
src/app/api/pos/payments/[id]/refunds/route.ts
src/app/api/pos/payments/[id]/route.ts
src/app/api/pos/payments/capabilities/route.ts
src/app/api/pos/payments/refunds/[id]/check/route.ts
src/app/api/pos/payments/route.ts
src/app/dashboard/pos/layout.tsx
src/app/dashboard/pos/payments/page.tsx
src/app/dashboard/pos/transactions/[saleId]/page.tsx
src/app/dashboard/pos/transactions/page.tsx
src/components/pos/Operations.tsx
src/components/pos/PaymentHistory.tsx
src/components/pos/PaymentPanel.tsx
src/components/pos/RefundPanel.tsx
src/components/pos/Register.tsx
src/lib/pos/domain.ts
src/lib/pos/payments/client.ts
src/lib/pos/payments/domain.ts
src/lib/pos/payments/orchestrator.ts
src/lib/pos/payments/provider.ts
src/lib/pos/payments/server.ts
src/lib/pos/receipt.ts
supabase/migrations/20260920211929_pos_payment_framework.sql
tests/label-workflow-browser.mjs
tests/pos-browser.mjs
tests/pos-db.mjs
tests/pos-operations-browser.mjs
tests/pos-payment-domain.test.ts
tests/pos-payment-http.mjs
tests/pos-payments-browser.mjs
tests/pos-payments-db.mjs
tests/pos-receipt-browser.mjs
```

Documentation commit: `docs/POS_ARCHITECTURE.md`, `docs/POS_PAYMENT_ARCHITECTURE.md`, `docs/POS_PHASE4_VALIDATION.md`.

## Known limitations and production gates

No production migration, deployment, rollout enablement, main merge, push, real merchant connection, terminal pairing, real charge or live refund occurred. All earlier production gates remain in force.

Reconciliation is durable and manually triggered; no background scheduler is deployed. Real Square/Stripe adapters must implement authenticated provider observation, raw-body verification, merchant/account/environment mapping, secure credential storage, provider-specific sandbox contracts and durable worker identity before live use. A different manager may reconcile/refund recovery, but cannot impersonate the original cashier to finalize inventory. Cashier finalization currently requires that authenticated actor and current authorization.

Stock is checked before dispatch and again during finalization; it is not held during asynchronous payment. Availability/price/delegation changes can therefore yield explicit paid-but-unfulfilled recovery. This state is retained and tested, with an authorized money-only refund route. Durable stock reservations remain a future refinement using canonical allocation primitives.

Payment history currently returns the latest 100 matching attempts. Full split-tender orchestration/UI, native card-present checkout, real provider accounts/devices, online card entry and physical terminal/printer/scanner acceptance are not included. Multi-tender storage and integer balance validation remain ready for later work. Legacy Phase 3 restock/provenance limits still apply.

Hosted auth/RLS, actual production prerequisite replay, real-provider sandbox acceptance and physical hardware validation remain separate mandatory release gates. Development completion is not production approval.
