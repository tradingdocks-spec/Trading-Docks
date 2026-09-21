# POS Phase 6 validation

Branch: `codex/pos-foundation`. Phase 5 baseline: `f2c902a` (implementation `c9c6932`). Phase 6 implementation: `f97ca98f35d88c0beab45d9fe386ebec7732af00`. Separate deterministic test repair: `b6e62e9`. This report is committed separately after implementation validation.

Status: **Implemented and verified locally with deterministic emulation. Production blocked. PHYSICAL TERMINAL QA: PENDING.**

## Delivered scope

- Extended the existing Square client/provider, encrypted connection, signed webhook endpoint, private observation ledger and canonical original-cashier finalizer. No parallel payment-sale ledger or privileged inventory finalizer.
- Verified OAuth scope persistence and Enable Terminal reauthorization. Required scopes: DEVICE_CREDENTIAL_MANAGEMENT, MERCHANT_PROFILE_READ, PAYMENTS_READ, PAYMENTS_WRITE. API version remains **2026-09-16**; no dependency added.
- Device-code create/retrieve contract, stable creation key, expiry/countdown, paired webhook/reconciliation, permanent device identity, friendly names, register assignment, rename, disable, optional authoritative health and hardware audit.
- Assigned-device checkout using immutable amount/currency, separate checkout/payment IDs, stable retry key, conservative lifecycle mapping, authoritative Payment verification, cancellation, busy/offline handling, reload recovery and waiting UI with cart lock.
- Ordinary Square refund regression and provider-specific card-presence Terminal refund contract. Safe receipt/history metadata and unchanged Square/cash reporting.

## Migration and security review

New migration: `20260920235705_pos_square_terminal.sql`. No Phase 1–5 migration changed. Applied only to disposable loopback PostgreSQL fixtures.

New canonical table: `public.pos_payment_devices`. It records workspace/site/connection, Sandbox environment, provider device/code/location identities, friendly name, pairing/operational status, assignment, creator, timestamps and disable state. Codes are separate in `pos_private.square_device_codes`. Private `square_terminal_attempts` freezes device/location and checkout identity; `square_terminal_refunds` separates Terminal refund identity; `square_hardware_audit` records operational changes. Existing connections gain verified `authorized_scopes`.

All new tables have RLS and revoked direct browser access. Safe RPC projection is site-authorized. Owner/admin manage devices; cashiers use assigned devices under existing permissions/delegation. Service-only actions cannot finalize stock. Composite foreign keys and assignment uniqueness prevent tenant/site mixing. A locked device serializes attempt creation and reassignment; unresolved attempts retain their device lock semantics through browser/network loss. Existing register-close guard remains effective.

Security tests cover unauthorized pairing/mutation, direct table/service access, anonymous denial, cross-site assignment, mismatched active provider location, arbitrary device injection, missing scopes, duplicate register assignment, signed event replay and wrong merchant/checkout correlation, disabled/unassigned devices, original-cashier finalization, and no token/card-data disclosure. Scope validation occurs in database preflight and adapter. Exact signature verification is reused unchanged.

Local Supabase advisors reported **five pre-existing mutable-search-path warnings**, on current_admin_role, is_admin, workspace_role_rank, collector_inventory_error_payload and raise_collector_inventory_error. No new Terminal advisor finding.

## Validation evidence

| Check | Result |
| --- | --- |
| Baseline root TypeScript, ESLint, tests, production build | Passed before runtime edits |
| Baseline mobile TypeScript, ESLint, tests | Passed |
| Final root TypeScript | Passed |
| Final root ESLint | 0 errors; 534 existing warnings |
| Root tests | **941 passed** |
| Terminal unit/HTTP contract tests | **10 groups passed**, included in root suite |
| POS database / text ledger | **121 groups passed** |
| POS database / enum ledger | **121 groups passed** |
| Full POS browser regression | Passed; run included 120 DB groups before the final additional cashier-boundary test |
| Mobile TypeScript | Passed |
| Mobile ESLint | 0 errors; 3 existing warnings |
| Mobile tests | **580 passed** |
| Next production build | Passed |
| Expo web, Android and iOS exports | Passed |
| Receipt PDFs | **18 passed**, including Square Terminal name/card metadata at 58 mm, 80 mm and Letter |
| Label PDFs | **9 passed**, plus six preset screenshots |
| Chaos Sort printing | **30 passed**, Chrome and Edge |
| git diff --check | Passed |

Logs are local ignored artifacts under `.local-fixtures/phase6-*`; screenshots are under `.local-fixtures/pos-db/terminal-*.png`. Production components, local authenticated SQL roles and real migrations were used. The HTTP emulator implements pairing/health, waiting, approval, cancellation, timeout/unknown, offline/busy, disconnection/lost response and delayed webhook delivery. No external Square request is required by automated tests.

The full root run exposed an existing randomized Base64 tamper-test flaw: changing the final character can change only ignored padding bits. Focused commit **`b6e62e9`** changes an actual signature byte in the test; it does not change capture authentication. The repaired complete suite passed. The original failure and diagnostic rerun are retained locally.

## Browser acceptance

Passed: Hardware pairing-code display → signed pairing event → register assignment; two inventory items → Square Terminal → waiting/cart lock → simulated approval → one receipt/sale and exact stock decrement; cash drawer unchanged; cashier cancellation → payable cart; decline → preserved cart → cash success; dropped response → reload → one reconciled sale; busy device → no sale; history and tablet Hardware; no browser runtime errors or tablet horizontal overflow. Active checkout also rejected a browser-originated register-close request.

Strict one-device/one-register assignment means two registers cannot legitimately share one local device. Database tests reject duplicate assignment and a second active attempt; the browser tests provider-reported busy state as the external-contention case.

Phase 1–5 browser suites still cover scanner ambiguity/labels, cash recovery, register lifecycle, staff/manager approval, refunds/reports, mock uncertain payments and Square Sandbox settings/reload recovery. Root/mobile tests cover Inventory, Orders Center and Chaos Sort contracts. This is not a claim of a fresh hosted Orders Center browser session or hosted Next/Supabase authentication acceptance.

## Provider and physical acceptance limits

**Actual Square Sandbox network acceptance: Requires Sandbox Configuration.** No merchant credentials were available or connected. Current Square documentation explicitly says Sandbox does not support the Devices API; real hardware does not interact with its Terminal simulation. Pairing/Devices HTTP and webhook contracts were therefore emulated. Square's special Sandbox checkout IDs can be used in a separately configured developer acceptance fixture; production credentials must not be substituted.

**PHYSICAL TERMINAL QA: PENDING.** No physical pairing, tap/insert/swipe, paper receipt or real hardware refund is claimed. The hardware acceptance checklist and supported-environment prerequisite are in [POS_SQUARE_TERMINAL.md](POS_SQUARE_TERMINAL.md). Native exports are bundle validation, not installed-device acceptance.

Card-presence refund orchestration is HTTP-contract-tested with a Canadian Interac-shaped fixture. Existing USD retail rules are unchanged, and ordinary US refunds use the normal Refunds API. Devices API monitoring is Beta and not a real-time online guarantee. The checkout uses Square's documented five-minute default rather than its deprecated deadline field. Tipping is disabled and Terminal receipt prompts are skipped.

No deployment, hosted migration, environment/secret change, live merchant connection, real-money charge/refund, main merge, or applied-migration edit occurred. Production remains blocked.
