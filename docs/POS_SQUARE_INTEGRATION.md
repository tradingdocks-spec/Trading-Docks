# Square integration — Phase 5

Status: Implemented in development source with mocked Square HTTP contract validation.
Real Square Sandbox seller acceptance requires configuration. Production remains blocked.

## Foundation audit and reuse

The Phase 4 PaymentProvider interface, PaymentOrchestrator, immutable checkout snapshots,
payment/refund attempts, session guards, safe history views, and canonical cash_command/refund
finalizers remain authoritative. Square HTTP responses enter a private observation ledger;
authenticated callers cannot supply a payment success. Provider IDs and location snapshots
belong to attempts, not mutable checkout preferences. Existing marketplace AES-256-GCM
credential encryption is reused, with server configuration only.

Existing account/location types were placeholders; Phase 5 supplies persisted connections,
encrypted credentials, one-time OAuth state, cached locations, and explicit site mappings.
Owner/admin manage connections; cashiers use the existing sell/refund authorization rules.
Existing billing integrations are unrelated to store merchant accounts.

## Protocol decisions

Square API version: `2026-09-16`. SDK: `square@46.0.0`, used for the official
WebhooksHelper. Centralized direct HTTP keeps SDK types outside the POS domain.
Only `https://connect.squareupsandbox.com` is allowed. PRODUCTION is rejected.

Confidential server authorization-code flow uses a client secret and cryptographic,
single-use state tied to actor, workspace, expiry and fixed internal return route.
Square recommends this flow for confidential servers; its PKCE flow targets public clients
and uses expiring single-use refresh tokens. No client secret or token reaches the browser.

Scopes: MERCHANT_PROFILE_READ (merchant identity and locations), PAYMENTS_READ (payment
and refund reconciliation), PAYMENTS_WRITE (payments and refunds). Device credentials
will require a new consent flow in Phase 6. Catalog, customer and order scopes are excluded.

References: [OAuth flows](https://developer.squareup.com/docs/oauth-api/overview),
[permissions](https://developer.squareup.com/docs/oauth-api/square-permissions),
[signature verification](https://developer.squareup.com/docs/webhooks/step3validate),
[Sandbox payments](https://developer.squareup.com/docs/devtools/sandbox/payments),
[API reference](https://developer.squareup.com/reference/square).

## Sandbox setup

1. Create an application and Sandbox test seller in the Square Developer Console. Use the
   Sandbox application ID and secret, never the production tab or a live seller.
2. Configure the OAuth redirect URL as the development HTTPS origin followed by
   `/api/pos/payments/square/callback`. Set `SQUARE_OAUTH_REDIRECT_URL` to that exact URL.
3. Set the server-only names in `.env.example`: `SQUARE_APPLICATION_ID`,
   `SQUARE_APPLICATION_SECRET`, `SQUARE_ENVIRONMENT` (`SANDBOX`),
   `SQUARE_OAUTH_REDIRECT_URL`, `SQUARE_WEBHOOK_SIGNATURE_KEY`,
   `SQUARE_WEBHOOK_NOTIFICATION_URL`. Configure `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY`
   with at least 32 characters and its key-version identifier. Existing server Supabase
   service credentials are needed for the restricted integration RPC. No secret is public.
4. Register a Sandbox webhook subscription for `payment.created`, `payment.updated`, and
   `oauth.authorization.revoked`. Copy its signature key into server configuration. The
   notification URL ends in `/api/payments/webhooks/square`.
5. Use an approved development HTTPS tunnel or development hostname. No tunnel URL is
   hard-coded and no tunnel was started for this change. Square must reach that URL.
   Behind a proxy, signature verification uses the exact configured public notification
   URL, including path and trailing-slash choice, never a reconstructed internal URL.
6. In a development instance with the additive migration applied, sign in as workspace
   owner/admin, open POS → Payments, and connect the Sandbox seller. Map each store
   explicitly. Check Connection validates token status and refreshes cached locations.
7. In development/test mode, a mapped register offers **Square Sandbox — developer test**.
   It sends the fixed server-side `cnon:card-nonce-ok` test source. There is no card form,
   browser-supplied nonce, live-charge path, or production-build test-payment creation.

No real Square credentials were present in this workspace. Configuration values were not
invented, secrets were not written, and actual seller consent or external Sandbox payment
execution was not claimed. The local fixtures emulate the documented HTTP contracts.

## OAuth and account lifecycle

The server generates 32 random bytes of state, persists only its SHA-256 digest, and binds
it to the verified user/workspace, SANDBOX, a ten-minute expiry and fixed POS return route.
Atomic consume rejects invalid, expired and replayed state before exchanging the code.
Switching workspace or actor during consent rejects the callback. Callback query parameters
cannot select another workspace or redirect host. Denial consumes state without exchanging
or persisting any token and displays the required no-changes message.

Merchant identity and locations must both load before an encrypted connection is saved.
Ciphertext, random IV, authentication tag, algorithm and key version live separately from
safe connection metadata. AES-256-GCM uses the accepted marketplace credential helper;
the key comes only from the server environment. Key rotation requires coordinated credential
re-encryption using that existing strategy; changing the key alone cannot decrypt old rows.

Token access renews a standard thirty-day token after approximately seven days (23 days
remaining). A database lease allows one refresh owner for 45 seconds; a competing worker
can use an unexpired token or return a temporary recovery error. Saves match the lease,
so a late response cannot overwrite a newer refresh or deleted credentials. Invalid
authorization marks attention; transport failures retain recoverable connection state.
Refresh is demand-driven in this phase. Scheduled renewal/alerting for idle merchants is
a production-readiness follow-up; no deployment or cron configuration was added.

Disconnect is confirmed in the UI, revokes the seller authorization, retires credentials
and preserves sales, receipts, refunds and connection IDs. Verified revocation events retire
credentials as well. Same-merchant reauthorization reuses its non-replaced identity so
historical refunds can resume. A different active merchant is rejected with an explicit
replacement warning; the owner disconnects first. Different merchants receive different
connection IDs; historical attempts are never reassigned. Replaced connections remain
historical and cannot be used with a new merchant's credentials.

## Location and tenant boundary

Connections are scoped to workspaces. Mappings have composite workspace/site and
workspace/connection foreign keys and a single mapping per connection/site. Inactive
Square locations and non-USD locations are not selectable. Inactive merchants cannot complete
the connection flow. Check Connection/reconnect refreshes location metadata;
location webhooks are deliberately deferred. Multiple Trading Docks sites can map to the
same Square location if that matches the owner's operation.

The database derives the merchant connection and Square location from the authenticated
checkout site/session; it rejects arbitrary browser location/source fields. Each attempt
freezes its connection ID and location metadata. Mapping changes affect future attempts.
Normal authenticated/anonymous roles cannot read any credential, OAuth or observation table,
or execute `pos_square_service`. The server-only service RPC handles encrypted credentials
and provider observations; it cannot finalize sales/refunds or mutate inventory. Settings
read/map operations explicitly require current workspace owner/admin. Cashier checkout and
refunds retain the Phase 3/4 permissions, site authorization, delegation and original actor.

## Payment, refund and recovery

`SquarePaymentProvider` implements the accepted PaymentProvider contract and is injected
into PaymentOrchestrator. Generic callers do not import Square SDK types. The canonical
database creates the immutable attempt and performs financial, stock and session preflight.
The adapter then calls Square outside the database transaction, persists a normalized
observation through the private server boundary, and lets the orchestrator observe/finalize.

The attempt UUID is Square's payment idempotency key and reference ID. The refund-attempt
UUID is the refund idempotency key. Authoritative Square payment/refund IDs are stored
separately. If a response is lost before its provider ID is saved, replay uses exactly the
same provider operation/key/body to recover its response; it does not create a new logical
charge/refund. Once the provider ID is known, reconciliation uses GetPayment/GetPaymentRefund.
Canonical local cumulative refund and inventory-return checks remain authoritative.

Square COMPLETED → SUCCEEDED; APPROVED → AUTHORIZED; PENDING → PENDING;
CANCELED → CANCELED; FAILED → FAILED; unknown values → UNKNOWN. Payment-method error
responses normalize to DECLINED. Refund COMPLETED → SUCCEEDED; PENDING → PENDING;
REJECTED/FAILED → FAILED; unknown → UNKNOWN. Authentication, configuration, transient/rate
limit, network and unknown errors expose generic safe categories, never provider payloads.
HTTP retries are bounded to three requests, honor short Retry-After values, and return a
temporary error instead of waiting through a long rate-limit delay. Network failures are
recovered through the same idempotent operation. Raw PAN/CVV/track/EMV data are neither
collected nor copied. Persisted safe metadata is limited to environment, verification,
location ID, card brand and last four digits.

Cash/manual remain independent of Square configuration. Square does not alter expected cash.
History and transaction detail show Square Sandbox, safe references, timestamps, status and
location. Daily reports separately expose Square sales and confirmed local refunds. These
are transaction totals, not settlements or payouts.

## Webhook semantics and original-cashier finalization

The dedicated Node handler bounds and reads the original request bytes, then calls the
official SDK `WebhooksHelper.verifySignature` with the signature header, subscription key,
exact configured URL and original UTF-8 body. No event is parsed or persisted before
verification. Event IDs are globally unique within this Square integration. The durable
inbox stores only event ID/type, merchant/resource IDs and processing timestamps/status.

Payment notifications are correlated to a local merchant/payment/reference and independently
retrieved from Square before persisting normalized observations. Amount, currency, provider
identity and frozen location must agree. Unknown event types are acknowledged without money
or stock changes. Revocation is handled independently. Failure leaves RETRY/PENDING and
returns 503 so Square can retry; processed is recorded only after the observation transaction
commits. Replays and concurrent polls converge through the original locks/idempotency.

**The accepted original-cashier finalization boundary remains in force.** A webhook durably
records provider state but does not invent an authenticated cashier or use service role to
write inventory. Check Payment Status consumes the observation and runs the canonical
finalizer with the original authenticated actor's current stock permissions. Thus webhook
processing completion does not itself mean sale completion. Unattended inventory finalization
is not implemented. Refund webhooks are not subscribed; generic Check Refund Status retrieves
authoritative refund state. A disconnected refund requires reconnecting the original merchant;
it never fabricates local refund success.

## Phase 6 and production gate

Device credentials/Terminal consent, pairing, card-present collection, hardware cancellation,
split tender, durable inventory reservations, unattended worker finalization, settlement and
payout reporting are not implemented. Phase 6 can supply a tokenized/device operation through
the same provider interface without changing the sale/refund finalizers. Real Sandbox consent,
token refresh, delivery through the configured public HTTPS webhook URL and seller-dashboard
verification remain external acceptance steps. Production deployment, production migrations,
live credentials/merchant authorization/charges/refunds and main-branch merge remain blocked.
