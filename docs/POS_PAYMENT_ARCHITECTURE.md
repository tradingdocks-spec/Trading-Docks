# POS payment architecture

Status: Implemented in development source, 2026-09-20. Phase 4 development accepted; production remains blocked. See [validation](POS_PHASE4_VALIDATION.md).

## Phase 5 extension

Square Sandbox now supplies an injected `SquarePaymentProvider`, confidential-server OAuth,
encrypted credentials, merchant/location administration, explicit site mappings, payment and
refund HTTP operations, official SDK webhook verification, and provider reconciliation.
See [Square integration](POS_SQUARE_INTEGRATION.md) and [Phase 5 validation](POS_PHASE5_VALIDATION.md).
The audit sections below describe the original Phase 4 starting point.

The additive Phase 5 migration expands the canonical provider/tender constraints and command
functions. Private Square observation tables are populated only by the restricted server RPC;
authenticated `observe` consumes those records through the accepted state machine. Sale and
refund finalizers remain unchanged. Browser statuses and arbitrary payment location/source
fields are not authority. Square IDs use immutable attempt/refund UUIDs for provider idempotency.

Square webhooks verify raw bytes using `square@46.0.0` and the configured public notification
URL. A durable deduplicated inbox supports retry/revocation. Webhook observation persistence
does not bypass original-cashier finalization: current authenticated permission is still
required to finish stock/sale/receipt effects. No service-role inventory worker was introduced.
Cash and external tender are independent; Sandbox test-source creation is development/test
only. Real Sandbox credentials/consent and public webhook delivery remain unconfigured here.

## Audit before implementation

Phases 1–3 already provide canonical immutable `pos_sales`, `pos_sale_items`, allocation snapshots, multiple-row `pos_tenders`, item refunds and cash ledger. The tender method constraint is cash-only. `pos_private.cash_command` owns atomic stock/sale/receipt finalization; `pos_private.refund` owns canonical returns. `pos_operation_receipts` provides actor/key/intent replay. Reuse these instead of building another sales or inventory system.

No POS payment-attempt/provider orchestration exists. Billing Stripe/RevenueCat integrations are subscription infrastructure, not merchant POS accounts. Existing marketplace reconciliation utilities are channel-specific. Webhooks elsewhere have provider-specific authentication; none constitutes verified POS event ingestion. `src/lib/marketplaces/credentials.ts` uses AES-256-GCM with IV/tag/key version. Phase 5 must use that reviewed encryption pattern and server-only scoped credential references; no processor credentials or new environment values are introduced in Phase 4.

The Next route convention uses authenticated server capability/context resolution, same-origin writes, bounded streamed JSON and uncached responses. New resource routes reuse that boundary. Database mutation remains through authenticated RPC with unchanged inventory owner/delegation authorization. A provider result supplied by a browser is never trusted as proof of payment.

## Implemented boundary

Payment checkouts freeze server-calculated financial intent. Attempts and provider observations persist separately from final sale. Provider success is durable before finalization; failure to finalize retains recovery state. Each provider call is separately committed from inventory mutation. Mock provider state lives in a private deterministic test ledger, disabled by default at the database and rejected by production server routes. No publicly callable RPC can set arbitrary successful provider status.

The initial asynchronous adapter is MOCK. CASH remains atomic. EXTERNAL is explicitly merchant-recorded and unverified. Provider account/location/device types prepare future adapters without connections, secrets or pairing. Raw webhook verification is a required adapter hook, with no fake signature endpoint. Normalized events trigger authoritative retrieval, not blind payload application.

No stock is reserved merely by beginning a payment in this phase. Availability is checked before provider initiation and again under existing inventory locks at finalization. A rare stock, delegation or pricing change creates explicit successful-payment/recovery-required state; it never loses the successful payment or enables a second charge. Current cashier authorization still applies at finalization. Refund of an unfulfillable payment provides a money-only recovery path. Future durable reservations are a separate refinement using canonical reservation primitives.


## Provider interface and routes

`src/lib/pos/payments/provider.ts` defines `PaymentProvider`, optional cancellation/refund/event/location/device methods, and capability flags. `MockPaymentProvider` and `ExternalPaymentProvider` implement supported operations. CASH remains the existing synchronous authoritative command with a shared capability manifest; it does not need asynchronous polling. The interface uses a persisted attempt identifier, so an adapter resolves amounts and currency from the authoritative repository rather than client input. Future account, location and device models exist as types only. No connection table or credentials are needed for the current adapters.

The orchestrator begins, retrieves, cancels, reconciles and finalizes payments and refunds using the adapter contract. Resource routes are:

- `POST /api/pos/payments`: create/replay an attempt and begin its provider operation.
- `GET /api/pos/payments`: scoped history with method/status/sale filters, latest 100 attempts.
- `GET /api/pos/payments/capabilities`: environment-filtered availability.
- `GET /api/pos/payments/[id]`: safe persisted detail.
- `POST /api/pos/payments/[id]/check`: authoritative provider retrieval, observation and eligible finalization.
- `POST /api/pos/payments/[id]/cancel`: supported safe cancellation and reconciliation.
- `POST /api/pos/payments/[id]/refunds`: independent idempotent refund initiation.
- `POST /api/pos/payments/refunds/[id]/check`: refund reconciliation and local completion retry.

Writes verify same origin and bound streamed JSON to 32KiB. Server context supplies the workspace and authenticated user. Responses are uncached. Provider SDKs and private database state never enter browser code. No raw PAN/CVV/expiry fields exist.

## Persistent state and transitions

`pos_payment_checkouts` holds immutable original intent and SQL financial snapshot, canonical site/register/session/actor, currency and amount. Customer remains the accepted guest checkout. Payment state is in `pos_payment_attempts`; sale state is in the checkout. Completed sales, receipts, tender rows and inventory allocations remain the Phase 1–3 canonical records.

| Checkout state | Allowed next state |
| --- | --- |
| PAYABLE | PAYING |
| PAYING | PAYABLE for definitive decline/failure/cancel; FINALIZING for confirmed success |
| FINALIZING | COMPLETED, RECOVERY_REQUIRED, VOIDED after confirmed money-only recovery refund |
| RECOVERY_REQUIRED | COMPLETED, RECOVERY_REQUIRED, VOIDED |
| COMPLETED / VOIDED | Terminal; no rewriting |

Attempts begin CREATED. CREATED/PENDING/AWAITING_CUSTOMER/PROCESSING/AUTHORIZED/UNKNOWN/TIMED_OUT may move among active or authoritative success/decline/failure/cancel states. A timeout is uncertain. DECLINED/FAILED/CANCELED cannot subsequently become successful. SUCCEEDED may enter refund states; SUCCEEDED/PARTIALLY_REFUNDED/REFUND_PENDING may move to PARTIALLY_REFUNDED or REFUNDED, with REFUNDED terminal. Identity, amount, currency, intent and checkout linkage are immutable; transitions are checked in SQL and mirrored in domain tests.

Refund attempts independently use CREATED/PENDING/UNKNOWN/SUCCEEDED/FAILED. Provider refund success is distinct from completion of the canonical item-return record. `recovery_required` retains that distinction if local restock or session authorization fails.

## Idempotency and trust

Creation is unique by workspace, actor and initiation key, binding the exact request. The immutable checkout key identifies the cart across attempts. Only a definitive failed/declined/canceled attempt releases a checkout for another attempt; partial/full refund does not reopen the old checkout. An active-attempt unique index prevents a second charge path. Finalization uses the checkout's stable sale key, and each payment attempt can link to only one tender. Schema still allows several tender rows per sale; split-tender orchestration/UI is not enabled.

Provider request identity is the attempt ID, persisted before dispatch. MOCK stores one private provider record per attempt and one per refund attempt. Repeated dispatch retrieves the same logical provider operation. Refund initiation has a separate actor/key/intent binding and cumulative amount checks. Pending refunds reserve the remaining refund capacity and block another refund request until resolved.

Observation RPCs do not accept arbitrary provider status or amount. MOCK observations read the private simulator ledger; EXTERNAL is always explicitly merchant-recorded. A private transaction/backend/actor-bound `payment_context` permits the existing finalizer to produce a noncash tender only for a successful persisted attempt. Refund context similarly requires a confirmed refund. Client flags or session GUCs cannot fabricate either context. No service-role shortcut or inventory impersonation exists.

## Inventory, authorization and closing

Preflight uses current canonical prices, owner/site delegation, exact-position existence/availability, aggregate parent availability and marketplace allocations. It obtains the shared owner/item/position locks. Dispatch revalidates an unpaid CREATED attempt against the current rollout, actor, inventory and snapshot immediately before provider initiation. These locks are released before a later asynchronous provider result; this phase deliberately does not promise a stock reservation.

Finalization reacquires the canonical locks, reauthorizes stock, and verifies the frozen snapshot again inside the existing sale finalizer. Revocation after provider success cannot silently authorize stock movement. Instead, payment stays SUCCEEDED and checkout becomes RECOVERY_REQUIRED. Restoring valid fulfillment conditions allows the same attempt to finalize exactly once. A manager may request a confirmed money-only refund of an unfulfilled successful payment; the checkout then becomes VOIDED with no sale or stock movement.

Session locks serialize initiation/finalization with close. Unresolved payment checkouts and pending/recovery refunds block drawer closing. A completed card/mock/external sale and refund do not change expected drawer cash. Daily reports now derive cash totals from cash events and noncash totals from noncash tenders/confirmed local refunds.

Permissions reuse the existing POS model: `pos.sell` plus the accepted owner/delegation and site rules authorizes taking payment; reads/checks/cancellation allow the requesting actor or an eligible site manager. Refunds independently require `pos.refund`; canonical return authorization remains unchanged. Manager access to another actor's payment requires eligible site access as in Phase 3. No account-management or terminal-management UI is exposed to cashiers.

Canonical finalization retains the original authenticated cashier. A different manager may reconcile provider status, inspect recovery and issue an authorized unfulfilled-payment refund, but cannot finalize inventory by pretending to be the cashier. Background finalization identity for real authenticated webhooks requires the explicit Phase 5 integration boundary described below.

## Deterministic simulator and production safety

| Outcome | Provider behavior |
| --- | --- |
| APPROVE | Immediate authoritative SUCCEEDED |
| DECLINE | Definitive DECLINED, no sale |
| CANCEL | Definitive CANCELED, no sale |
| TIMEOUT | TIMED_OUT until safe cancellation; never automatically payable |
| DELAYED_SUCCESS | PROCESSING, then success on the second explicit retrieval |
| UNKNOWN_THEN_SUCCESS | UNKNOWN, then success on the second retrieval |
| UNKNOWN_THEN_DECLINE | UNKNOWN, then definitive decline on the second retrieval |
| REFUND_SUCCESS | Confirmed provider refund |
| REFUND_FAIL | Definitive failed refund; no completed local return |
| REFUND_UNKNOWN_THEN_SUCCESS | Uncertain response until explicit refund reconciliation confirms success |

There is no randomness or clock-based simulation. Private ledger data survives browser/server reloads. The simulator is a separate committed persistence stage, not an in-memory mock that forgets a successful operation after restart.

`pos_private.payment_test_config` defaults disabled in the migration and is inaccessible to authenticated/anonymous clients. Only the disposable PostgreSQL test harness enables it. The adapter rejects any environment other than `development` or `test`; production route capabilities and client controls also suppress Mock Card. No environment file was changed. Enabling the local simulator is not a production configuration instruction.

## Events and reconciliation

`PaymentProvider.verifyEvent(rawBody, headers)` is optional and mandatory before generic ingestion accepts external bytes. It must perform the real provider's authentication and resolve account/tenant identity. MOCK has no signature verifier and exposes no fake public webhook endpoint. Tests simulate internal events by invoking authoritative observation of the private provider ledger, not by asserting arbitrary success payloads.

`pos_payment_events` deduplicates workspace/provider/external-event identity, retains processing state, rejects reuse for a different payment, and records only normalized status. Verified events trigger provider retrieval before application. Poll, event and explicit reconciliation converge on the same locked attempt and finalizer. A committed provider result with interrupted local completion remains queryable and retryable.

`pos_payment_audit` is append-only and records actor, attempt, initiation, state changes, reconciliation, sale completion/recovery and refund lifecycle. Structured server logs contain operation, attempt ID and normalized error category; no credential/card payloads or raw provider errors are logged. User messages explain decline, unavailable configuration and uncertain status without exposing processor internals.

## Refund and receipt behavior

Provider refunds calculate amounts from the original immutable sale lines and cumulative quantities through the Phase 3 integer refund quote. Cash refunds stay local. Noncash tenders reject the cash-refund command. Provider success is persisted before `pos_private.refund` attempts the unchanged canonical return path. Explicit no-restock produces no inventory mutation; exact restock provenance failures retain a successful provider refund plus local recovery status. Failed provider refunds create no completed refund record. Refunded quantity/tax rounding conserves the original sale totals.

Noncash refunds use a current open processing session and preserve original cashier/refund actor attribution. One unresolved refund is allowed per attempt, preventing overlapping amount/quantity commitments. A lost response is retried with the original key. Existing legacy receipt and return limits remain in force.

Receipt snapshots display CASH, simulated MOCK, or EXTERNAL with explicit verification wording. Only allowlisted safe brand/last4 metadata appears; cash/manual receipts never invent card data. Thermal 58/80mm and Letter print layout remains isolated from application chrome. Transaction history filters actual tender methods; payment history includes incomplete/failed attempts and separate payment versus sale state.

## Future Square/Stripe requirements and explicit limits

No processor SDK, OAuth account, credential, provider location mapping, terminal pairing, webhook deployment, real charge or live refund was added. Account/location/device types and adapter capabilities are the foundation, not an assertion that these integrations work.

Phase 5 must implement real raw-body signature verification, merchant/account/environment binding, secure AES-GCM credential references/rotation, SDK amount/currency conversion, provider idempotency and status normalization, actual provider cancellation semantics, and durable authenticated event/reconciliation workers. The worker must preserve initiating actor attribution without synthesizing an owner JWT; any finalization authority beyond the current authenticated actor path must be explicitly reviewed and tested. Real money remains blocked until that boundary and provider-specific sandbox contracts pass.

There is no automatic scheduler or background charge retry. Recovery is durable and explicitly requested through Check Payment Status / Check Refund Status. History is currently capped at 100 payment attempts. Split tender, durable stock holds, online card entry and installed native card-present checkout remain Planned. Hosted Supabase auth/RLS, actual production prerequisites and physical POS devices remain separate acceptance gates.
