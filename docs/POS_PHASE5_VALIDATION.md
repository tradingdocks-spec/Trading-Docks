# POS Phase 5 validation

Date: 2026-09-20. Branch: `codex/pos-foundation`.

Status: Implemented and locally validated against Square HTTP fixtures. Real Square Sandbox
seller authorization and public webhook delivery remain unconfigured and unverified.
Production remains blocked. Phase 6 hardware work has not started.

Implementation commit: `c9c6932ffc10d6a4c5365beab3e801c7f162ebb1` (based on accepted Phase 4 `51e959b`).
This report is committed separately after the implementation so it can identify its exact SHA.

## Delivered scope

- SquarePaymentProvider is injected into the accepted PaymentOrchestrator. The Phase 4
  canonical sale/refund finalizers and inventory delegation rules are unchanged.
- Node OAuth start/callback with 256-bit random, hashed, one-time, actor/workspace-bound
  ten-minute state and fixed internal return route. Denial is safe. Confidential-server
  authorization-code flow is used; the PKCE decision is documented in the integration guide.
- Separate encrypted credential storage, safe merchant history, explicit active site mappings,
  demand-driven token refresh with a database lease, token-status health check, reauthorization,
  confirmed disconnect and verified authorization revocation.
- Sandbox-only payment creation, payment retrieval, partial refunds, refund retrieval,
  stable Square/internal idempotency, normalized statuses/errors and bounded HTTP retry.
- Official Square webhook verification over raw body/exact configured notification URL,
  durable event deduplication/retry, independent payment retrieval, and private observations.
- Payment settings, Sandbox banner, store mappings, development-only Sandbox test checkout,
  payment history/detail metadata, Square history filters and separate daily sales/refunds.
- Safe unavailable-store preflight rejection allows choosing cash without clearing an
  already-started or uncertain attempt. Cash/manual operations remain independent.

Square dependency: `square@46.0.0`, pinned with lockfile, for official WebhooksHelper.
Centralized HTTP uses `Square-Version: 2026-09-16` and the fixed Sandbox hostname.
Scopes: `MERCHANT_PROFILE_READ`, `PAYMENTS_READ`, `PAYMENTS_WRITE`. Device credentials
require future Phase 6 consent; no catalog/customer/order scope is requested.

## Migration and permissions

New additive migration: `20260920220340_pos_square_sandbox.sql`.
No Phase 1–4 migration was modified. Only disposable loopback PostgreSQL fixtures received
the migration; no hosted database was reset, migrated or otherwise changed.

Private tables: square_connections, square_credentials, square_oauth, square_locations,
square_mappings, square_observations, square_refund_observations, square_events.
All have RLS and revoked browser-role privileges. Only the restricted server service RPC
can access credentials/observations. Authenticated settings operations require owner/admin.
Composite foreign keys prevent cross-workspace mapping. One active connection per workspace,
one mapping per connection/site, and immutable attempt connection/location identity apply.

The service RPC cannot impersonate a cashier or invoke inventory/sale/refund finalization.
The original actor's authenticated canonical command retains that responsibility.
Owner/admin can manage connections; managers/cashiers cannot. A delegated employee with
pos.sell can use Square for owner inventory with the employee retained as the sale actor.

Credentials reuse AES-256-GCM with random IV, authentication tag and server-only
MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY/key-version configuration. No actual environment
value was added. `.env.example` now includes blank Square/key configuration names.

## Validation evidence

| Check | Result |
| --- | --- |
| Baseline root typecheck/build | Passed before runtime changes |
| Baseline root tests | 920 passed |
| Root `npm run typecheck` | Passed |
| Root `npm run lint` | 0 errors; 534 existing warnings |
| Root `npm test` | 931 passed, including 11 Square unit/HTTP/security groups |
| Focused lint on Square/payment changes | Passed with no warnings |
| Root `npm run build` | Passed; local optimized production build only |
| PostgreSQL text ledger + browsers | 111 database groups passed; browser flows passed |
| PostgreSQL enum ledger | 111 database groups passed |
| Square database groups | 14 groups within each 111; real canonical SQL plus fixture HTTP |
| Mobile `npx tsc --noEmit` | Passed |
| Mobile `npm run lint` | 0 errors; 3 existing warnings |
| Mobile `npm test` | 580 passed |
| Expo web/Android/iOS export | All passed via `expo export --platform all` |
| Receipt PDFs | 18 groups: cash/mock/Square × 58/80/Letter × 1/25 items |
| Label Studio PDFs | 9 groups, up to 500 labels; six preset screenshots |
| Chaos Sort Chrome/Edge print | 30 passed |
| `git diff --check` | Passed |
| Local Supabase security advisors | No new Phase 5 finding; five existing fixture/prerequisite warnings |

The five advisor warnings are mutable search_path on current_admin_role, is_admin,
workspace_role_rank, collector_inventory_error_payload and raise_collector_inventory_error.
All new integration functions use fixed search paths and explicit execute privileges.
The CLI's generic “Connecting to remote database” banner referred to the explicit
`127.0.0.1:55439` disposable test database, not a hosted service.

Logs are under ignored `.local-fixtures/phase5-final-*.log`. Browser evidence includes
`pos-db/square-sandbox-complete.png` and `pos-db/square-settings-tablet.png`. Receipt
artifacts are under `pos-receipts/`. Expo artifacts are under `phase5-expo/`.

## Tested security and recovery cases

OAuth: random/hashed state, actor mismatch, absent/invalid/expired/replayed state, denial
without exchange, exchange failure, merchant failure, location failure and successful
encrypted connection. Fixed return-path behavior and production/mixed configuration guards.

Credentials: randomized encryption, tamper failure, safe settings serialization, successful
refresh, failed authorization, lease contention and credential retirement. No browser role
can read credentials or invoke the trusted observation function. Owner/admin management,
manager/employee denial, anonymous denial, cross-tenant denial and delegated employee checkout.

Mappings: unmapped checkout denial, inactive target denial, cross-tenant mapping denial,
arbitrary browser location/source/card-field rejection, explicit merchant replacement,
same-merchant reauthorization and preserved historic account/location identity.

Payments/refunds: create/get, identical keys, decline, unknown status, provider success with
lost response, concurrent checks, one sale/receipt/stock decrement, partial refund with lost
response, duplicate refund recovery, cumulative cap, no cash-drawer effect and separate
Square reporting. Revocation during a pending payment prevents another charge; reconnect
recovers the same attempt. Historical records remain readable after revocation.

Webhooks: official valid signature, invalid signature, changed body/URL, duplicate event,
event replay, unknown event, retry persistence, revocation, signed success notification racing
cashier reconciliation, and no duplicate finalization. Browser-provided success is ignored.

Browser fixtures render the production POS components against authenticated-role local SQL
and the real orchestrator/Square adapter with fixture HTTP. They cover Phase 1 cash/scanning/
reload, Phase 2 Inventory → Label Studio → PDF → exact-position sale, Phase 3 approval/shift/
refund/reporting, Phase 4 uncertain payments/refunds, and Phase 5 Square reload recovery,
mapping display, tablet layout and disconnect confirmation. No page errors or horizontal
overflow were found. Existing root/mobile suites also cover Inventory, Orders Center,
reservations, Chaos Sort and related service contracts. This is not a claim of hosted
Next/Supabase login testing or a fresh live Orders Center browser session.

## Files

Added: `.env.example` (previously ignored local example, now tracked), this report,
`docs/POS_SQUARE_INTEGRATION.md`, the additive migration, `SquareSettings.tsx`,
`src/lib/pos/payments/square/{config,http,provider,server,service,webhook}.ts`,
`src/app/api/pos/payments/square/route.ts`, its callback route,
`src/app/api/payments/webhooks/square/route.ts`, `tests/pos-square.test.ts`,
and `tests/pos-square-db.mjs`.

Updated: package.json/lockfile; POS_ARCHITECTURE and POS_PAYMENT_ARCHITECTURE;
payment domain/orchestrator/server; API access registry; PaymentPanel, Register,
PaymentHistory, Operations; POS payments/history pages; local database prerequisites/harness,
payment HTTP/browser fixtures and receipt PDF fixture. No mobile runtime file changed.

## Known limits and production state

- No Square credentials were available. Actual Square Sandbox consent, refresh, payment/
  refund execution, merchant dashboard confirmation and public HTTPS webhook delivery are
  **Requires Sandbox Configuration**, not passed live acceptance. The documented contracts
  were exercised through controlled HTTP fixtures; no real cards or money were used.
- Verified webhooks persist observations. **Sale/refund inventory completion still requires
  the original authenticated actor's recovery command.** No fake cashier JWT or privileged
  background stock finalizer was introduced. Refresh is demand-driven; scheduled idle-account
  renewal/alerting is a production-readiness follow-up.
- No physical Terminal, pairing, card-present flow, raw card form, split tender, settlement/
  payout reporting, provider cancellation, or durable stock reservation was added.
- The accepted POS currency remains USD. Inactive merchants are rejected during OAuth;
  inactive or non-USD Square locations are unavailable for new mappings. Use a compatible
  USD Sandbox seller for acceptance.
- Exports validate web/native bundles, not native device installation or hardware execution.
- No deployment, hosted migration, production secret change, live merchant connection,
  real charge/refund, main merge, or Phase 6 work occurred.
