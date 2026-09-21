# Square Terminal — Phase 6

Status: **Implemented and locally verified through deterministic emulation.** Actual merchant consent and provider-network acceptance require Sandbox configuration. Production blocked. **PHYSICAL TERMINAL QA: PENDING.**

## Foundation audit

Phase 5 already provides the Sandbox-only Square HTTP client (API 2026-09-16), encrypted OAuth credentials and refresh leases, merchant history, active site/location mappings, verified raw-body webhooks, durable event inbox, and authoritative payment/refund observations. Extend these services; do not introduce another Square client or payment ledger.

Phase 4 owns immutable checkout amounts, attempt idempotency, register-close protection, payment/sale separation, and original-cashier finalization. Terminal checkouts must feed its existing observation/finalization path. A Terminal checkout ID is distinct from a Payment ID. Device assignment is new; the existing PaymentDevice interface is a placeholder, and Hardware currently only tests scanners and links to Label Studio.

Pairing and assignment require owner/admin. Existing pos.sell authorization permits cashiers to use their register's assigned device. Device records contain no credentials or login code. Pairing codes remain in private storage and are disclosed only to administrators while unexpired. Historical attempts retain their original device and Square location.

## Current provider contract decisions

Use API version 2026-09-16 and add DEVICE_CREDENTIAL_MANAGEMENT to MERCHANT_PROFILE_READ, PAYMENTS_READ and PAYMENTS_WRITE. Verify actual scopes through token status. Existing authorizations without the complete scope set require reconnecting.

Square's checkout deadline_duration is deprecated; use the documented five-minute provider default instead of sending that deprecated field. Cancellation remains pending until Square confirms it. Disable tipping and skip the Terminal receipt screen because Trading Docks owns receipts. No Terminal Actions dependency.

Square Sandbox uses special simulated device IDs and does not interact with physical hardware. Local deterministic emulation will exercise pairing and checkout without representing a physical device acceptance test. Do not use production credentials to work around that limitation.

References: [TerminalCheckout](https://developer.squareup.com/reference/square/objects/TerminalCheckout), [Devices](https://developer.squareup.com/reference/square/devices), [Terminal Sandbox](https://developer.squareup.com/docs/terminal-api/quickstart).

## Scope upgrade

Payments → Square → Enable Terminal — Reconnect Square requests all four permissions. The existing random, hashed, single-use, actor/workspace-bound OAuth state and fixed return path remain in force. Callback and connection check retrieve token status and save the actual returned scopes. Existing connections start with an empty verified scope set and cannot use Terminal APIs until verification/reconsent. Same-merchant reauthorization preserves connection identity and historical payments; replacing a merchant still requires explicit disconnect.

Both the assignment/attempt database guard and server adapter verify permissions. Missing authorization displays “Square must be reconnected to enable Terminal access.” A scope failure after an attempt has started does not permit clearing an uncertain payment.

## Device and pairing model

`public.pos_payment_devices` owns workspace/site/connection identity, Sandbox environment, permanent provider device ID, temporary provider code ID, friendly name, pairing status, operational status, assigned register, pairing deadline, pairing/last-seen timestamps, creator and disable timestamp. Composite foreign keys constrain the workspace, site, connection and register. Unique indexes constrain device identity and active register assignment.

`pos_private.square_device_codes` holds login codes separately. Administrators receive them only while unexpired and unpaired. Code creation persists the local UUID before contacting Square and reuses it as the provider idempotency key. An expired request cannot expose or reuse its code; Generate New Code creates a new identity. Device polling and signed `device.code.paired` events retrieve authoritative GetDeviceCode data, validate location/product/code identity and persist `device_id`, never the temporary code ID as Terminal identity. Pairing audit records are deduplicated.

Hardware separates pairing state from local status/assignment. Owner/admin can rename, assign, unassign, check and disable. Disabled devices retain history and cannot start new checkouts. No public unpair/delete endpoint is exposed by the documented Devices API; local disable/unassign does not claim provider unpairing.

Health monitoring resolves the pairing serial to the Devices API synthetic `device:` identifier through ListDevices, then calls GetDevice. AVAILABLE/OFFLINE are provider-reported observations; an existing or paired record alone is not called online. Missing/unknown health stays Paired. Last seen records a successful availability observation, not a real-time connectivity guarantee. Devices API health is Beta and optional; core checkout has no Terminal Actions dependency. Listing is bounded to ten pages per explicit check.

## Checkout and reconciliation

The browser sends `provider: SQUARE, method: square_terminal` with the existing intent. It never submits an authoritative provider device ID. The canonical payment create transaction resolves the register assignment, checks the active merchant/location/scopes and locks the device. Another unresolved attempt on that device is rejected before any network call. Terminal context is persisted with the attempt, using the existing immutable amount/currency snapshot.

`square_terminal_attempts` records frozen device/location and Terminal checkout ID separately from the public attempt's Payment ID. CreateTerminalCheckout uses the attempt UUID on every retry, including after a lost response. Pending checkout maps to AWAITING_CUSTOMER; IN_PROGRESS and CANCEL_REQUESTED map to PROCESSING; CANCELED maps to CANCELED; unknown statuses remain UNKNOWN. COMPLETED alone cannot succeed: exactly one associated Payment must be retrieved and match reference, identity, amount, currency and location. Its authoritative status enters the Phase 5 observation ledger and Phase 4 finalizer. Split payments remain unsupported and fail closed.

The existing signed webhook endpoint handles `terminal.checkout.created`, `terminal.checkout.updated`, and `device.code.paired`, alongside Phase 5 payment and authorization events. It verifies raw body/URL/signature, correlates merchant and checkout, retrieves authoritative state, records observations and marks the durable inbox processed only after successful handling. Unknown/mismatched events remain retryable. Terminal completion and cancellation cannot regress; the observation ledger also rejects late waiting states after processing.

Webhooks never finalize inventory or impersonate a cashier. The original authenticated cashier's recovery command completes the sale, receipt and exact inventory mutation once. The waiting UI locks the cart, displays the friendly device/amount and uses 3/6/12-second polling with hidden-tab pause and one in-flight UI request. Reload recovery retains the original persisted request key, including when no checkout response arrived. Network failures and unknown states never automatically start another logical attempt. Check Status remains available.

Cancel sends the existing checkout to Square's cancellation endpoint, after cashier confirmation. CANCEL_REQUESTED remains unresolved. Only authoritative CANCELED returns the cart to payable. Definitive busy/offline/decline rejections preserve a failed/declined attempt without a sale. Retry or cash requires a new logical attempt. HTTP retry remains bounded and reuses the same key; DEVICE_BUSY is not blindly retried.

Register-close protection is inherited unchanged. Reassignment is blocked while the device has an unresolved attempt; disable can stop new work while existing attempts continue reconciliation through frozen context. Mapping changes never rewrite an existing attempt.

## Refunds, receipts and accounting

Ordinary US refunds continue through `/v2/refunds`. Square's **`card_details.refund_requires_card_presence`** flag selects the provider-specific Terminal refund path only when true. That path stores its Terminal refund ID independently, uses the refund UUID for idempotency, and verifies the associated Refund before the accepted refund finalizer runs. Canceled Terminal refunds fail without a completed local refund. Current production POS currency rules remain USD; Canadian Interac is contract-tested, not enabled as a new retail currency. Card-presence refund checks use the original frozen device; no arbitrary refund routing input is accepted.

Receipts and history show Square, friendly Terminal name, safe card brand/last four, status, references and timestamps. Square Terminal uses the existing `square` tender and daily Square reporting. It does not create cash-ledger entries. Hardware audit records creation, pairing, rename, assignment/unassignment, disable, checkout dispatch and confirmed cancellation, not every hardware poll.

## Security and card-data boundary

All new tables have RLS. Direct browser-role access to device/private tables is revoked; authenticated RPCs project safe, site-authorized device information. Owner/admin checks protect all hardware mutations and pairing-code disclosure. Credential/observation helpers remain service-role-only with fixed empty search paths. Device rows and safe views contain no tokens. Cashiers retain existing `pos.sell`/delegation permissions. No new employee role or privileged finalization mechanism is introduced.

Trading Docks sends amount/device requests. Square owns card interaction. Only allowlisted payment metadata is retained; no PAN, CVV, PIN, track data or EMV cryptograms are requested, persisted or rendered. No raw provider responses are logged.

## Validation and physical acceptance

See [Phase 6 validation](POS_PHASE6_VALIDATION.md) for deterministic HTTP, database, browser, print and build evidence. Fixtures exercise actual provider/orchestrator code, real migrations and production React components with local authenticated SQL roles. They are not a hosted Next/Supabase login test.

**Square Sandbox does not support the Devices API.** The implemented Create/GetDeviceCode contract and pairing webhooks are tested by local emulation. A real Sandbox Terminal checkout can use Square's documented special test device IDs through an isolated developer fixture after a Sandbox merchant is configured; do not manually substitute a production serial, use production credentials, or portray emulated pairing as physical pairing. No real Sandbox merchant was configured during this phase.

**PHYSICAL TERMINAL QA: PENDING.** Before any separately approved hardware acceptance, confirm Square's supported test environment, then record pairing/assignment, test payment, customer and cashier cancellation, decline, browser reconnect, receipt and appropriate refund results. A production-only physical flow requires a new explicit approval; production access and real-money transactions remain blocked here.

Mobile can eventually call the same authenticated Terminal APIs without card-data handling or an embedded payment SDK. No mobile POS checkout surface is enabled in this phase. Expo exports validate bundles, not installed hardware behavior.
