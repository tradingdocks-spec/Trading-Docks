# POS external acceptance checklist

Status: **ENGINEERING + SQUARE SANDBOX READY / PHYSICAL HARDWARE ACCEPTANCE PENDING**. Production remains untouched. Pilot readiness: **NOT READY**. Engineering evidence is in [Phase 7B validation](POS_PHASE7B_VALIDATION.md).

Current continuation (September 21): inventory schema/backfill blocker **CLOSED**. Owner-accepted OAuth, merchant/location mapping, connection health, revocation/reconnection, payment, authentic webhook and finalization passes are preserved. Additional results below are acceptance only. Historical intake sections further down describe earlier states, not current blockers.

| Remaining requested gate | Current result |
|---|---|
| Authentic webhook replay/deduplication | PASS: original signed event replayed twice, HTTP 200; one event with unchanged processing timestamp and one original sale |
| Real Square refund | PASS: 109 cents, provider refund SUCCEEDED, one local refund and one stock restoration |
| Payment response loss and reload reconciliation | PASS for browser-to-staging response loss: discarded successful response, reloaded, retried identical key, one sale/tender/stock deduction |
| Refund response loss and reload reconciliation | PASS for browser-to-staging response loss: discarded successful response, reloaded, retried identical key and reconciled provider status, one refund |
| Token refresh/reauthorization where practical | Real revocation/reauthorization PASS. Automatic refresh NOT EXERCISED: fresh token expires October 21; refresh threshold approximately September 28. No expiry or credential mutation forced |
| Cash regression | PASS: 109-cent cash sale after Square configuration; closed drawer variance zero |
| Transaction/receipt/report reconciliation | PASS: three sales 327 cents less one refund 109 = 218; cash 109 + Square net 109 = 218; one tender per receipt |

Evidence: [replay](pos-square-authentic-replay.json), [recovery](pos-square-recovery-acceptance.json), [canonical reconciliation](pos-square-final-reconciliation.json), [software closure](pos-square-external-closure.json).

## Closure matrix — September 21, 2026

The owner authorized deterministic provider emulation for the remaining software contracts. This classification combines the accepted real Sandbox results with the explicit emulated results below; it does not claim live Terminal API delivery or physical hardware testing.

| Gate | Evidence classification | Result |
|---|---|---|
| OAuth, merchant, location mapping, health, revocation/reconnection | REAL SANDBOX PASS | Previously accepted; preserved |
| Payment, signed webhook delivery/replay, refund, browser-response loss/reload recovery | REAL SANDBOX PASS | Accepted provider objects and canonical ledger evidence |
| Cash, receipt/report reconciliation, no duplicate sale/refund, drawer variance | REAL SANDBOX PASS | Staging integration: 327 - 109 = 218 cents; zero variance |
| Square-to-server payment response loss | EMULATED PASS | Provider stores completed object then throws; original-key retry and concurrent checks recover one provider payment, one sale and one stock deduction |
| Square-to-server refund response loss | EMULATED PASS | Provider stores completed refund then throws; repeated checks recover one provider refund and one local refund |
| Terminal device-code creation/polling/expiry and pairing events | EMULATED PASS | Owner/scopes/mapped-location checks, immutable code identity, duplicate events, expiry and new-code identity |
| Terminal checkout/create/get/cancel and status normalization | EMULATED PASS | Unknown, pending, busy, offline, canceled and completed contracts; completion verifies authoritative Payment identity/amount/location |
| Terminal idempotency and webhook ordering | EMULATED PASS | Lost-create response, same-key retry, webhook/poll race, duplicate and stale created events converge once |
| Terminal device/location/register/tenant authorization | EMULATED PASS | Wrong-site, wrong-location, duplicate assignment, unassigned routing and unauthorized management denied |
| Terminal reload/recovery and register-close protection | EMULATED PASS | Browser reload recovers one sale; unresolved checkout rejects close with PAYMENT_ACTIVE |
| Refresh implementation/contracts | EMULATED PASS | Successful encrypted save, failed authentication, lease loser, one database lease, stale-save no-op and unchanged credential version |
| REAL AUTOMATIC TOKEN REFRESH | PENDING — token not yet due | Observation gate, not an engineering defect; existing expiry October 21, threshold approximately September 28; no real expiry altered |
| Barcode scanner | PHYSICAL HARDWARE PENDING | Pilot hardware required |
| Label printer and physical label scan-back | PHYSICAL HARDWARE PENDING | Pilot printer/media/scanner required |
| Receipt printer | PHYSICAL HARDWARE PENDING | Pilot printer/media required |
| Physical Square Terminal | PHYSICAL HARDWARE PENDING | Supported environment and separate authorization required |
| Physical Terminal operation in Sandbox | NOT AVAILABLE | Square excludes physical hardware from Sandbox |

All requested software-controlled closure gates pass at the evidence levels above. **Pilot readiness: NOT READY** until the intended hardware set is physically tested. Production deployment, migrations, Square connection, real money, main merge and tenant enablement remain prohibited. Real automatic refresh remains an observation gate and does not prevent this engineering classification.

| Gate | Dependency | Acceptance evidence required | Status |
|---|---|---|---|
| Sandbox application and merchant | Owner Square developer account | Real authorized seller MLFWZQVCJ9NP9 and location LZ2H61E38DWB3 verified | PASS |
| Real Sandbox OAuth | Application and isolated HTTPS test runtime | Owner-accepted consent, callback, merchant/location mapping, health, revocation and reconnection | PASS |
| Real webhook delivery | Public HTTPS notification endpoint and Sandbox signature key | Actual payment.created/payment.updated processed; original signed created event replayed twice after completion; no duplicate financial effect | PASS |
| Terminal API software contracts | Deterministic provider emulator and disposable PostgreSQL/browser harness | Device-code/create/get/cancel, signed-event normalization/order, routing, reload, close protection and one finalization; no live Terminal HTTP claim | EMULATED PASS |
| Physical Terminal in Sandbox | Square does not support physical hardware in Sandbox | Official Sandbox overview and Terminal quickstart rechecked; simulated device IDs are API-only evidence | NOT AVAILABLE |
| Physical Terminal pairing | Hardware and separate production approval | Correct merchant/location/device, pairing expiration, assignment and revocation | PENDING |
| Physical Terminal payment and interruption | Hardware, account setup and separate production approval | Device disconnect/network loss, browser restart, status recovery, cancellation and refund with exactly one financial effect | PENDING |
| Barcode scanner | USB/Bluetooth scanner | Keyboard wedge focus, fast/repeated/unknown codes, suffix, no unintended duplicate item | PENDING |
| Label printer and scan-back | Printer, media and scanner | 1/5/25/100 labels, exact dimensions, no trailing blanks, all codes scan to correct owner/item | PENDING |
| Receipt printer | Printer and roll media | 58/80 mm alignment, complete totals, cutter/feed, long receipt and reprint | PENDING |
| Standard printer fallback | Letter printer | Pagination, all items, no blank trailing pages | PENDING |
| Production migration/deployment and pilot enablement | Explicit owner approval and reviewed window | Preflight, backup/restore rehearsal, approved merchant/tenant, rollback/disable drill | PENDING |

## Owner Square Sandbox setup

1. Open Square Developer Console, choose **Applications**, create or select the Trading Docks test application, and switch to **Sandbox**. Create/select a Sandbox test seller and open that seller's Sandbox Dashboard in another browser tab before OAuth. Record the test merchant and location IDs in the acceptance record, never access tokens. [Square Sandbox](https://developer.squareup.com/docs/devtools/sandbox/overview), [OAuth overview](https://developer.squareup.com/docs/oauth-api/overview).
2. Use the owner-approved isolated Preview origin `https://trading-docks-pos-staging.vercel.app` for `<STAGING_HTTPS_ORIGIN>`. The September 21 staging fix allows Sandbox in an optimized build only when all pinned Preview, branch, database and URL checks pass. Production deployments remain blocked. See [staging deployment](POS_STAGING_DEPLOYMENT.md).
3. In the application's **Sandbox → OAuth** settings, register the exact redirect URL `<STAGING_HTTPS_ORIGIN>/api/pos/payments/square/callback`. Set the identical server variable `SQUARE_OAUTH_REDIRECT_URL`. The origin must use HTTPS; no query, fragment or user info. [Authorization URL setup](https://developer.squareup.com/docs/oauth-api/create-urls-for-square-authorization).
4. Configure only the isolated test runtime's secret store: `SQUARE_ENVIRONMENT=SANDBOX`, `SQUARE_APPLICATION_ID` (Sandbox ID beginning `sandbox-`), `SQUARE_APPLICATION_SECRET`, and `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY` (at least 32 characters). Never use `NEXT_PUBLIC_` for secrets; never paste them into chat or commit them. Keep the staging Supabase project fixed at `ukrcbmujzdyclrkghbvo`.
5. Connect through the existing owner Square settings. The app requests `MERCHANT_PROFILE_READ`, `PAYMENTS_READ`, `PAYMENTS_WRITE`; Terminal additionally requests `DEVICE_CREDENTIAL_MANAGEMENT`. Verify the consenting test merchant and explicitly map the intended Square location. Do not hand-build or bypass signed OAuth state.
6. In **Sandbox → Webhooks**, add `<STAGING_HTTPS_ORIGIN>/api/payments/webhooks/square` as the notification URL. Set the exact URL in `SQUARE_WEBHOOK_NOTIFICATION_URL` and the subscription signature key in server-only `SQUARE_WEBHOOK_SIGNATURE_KEY`. Subscribe to the implemented events `payment.created`, `payment.updated`, `terminal.checkout.created`, `terminal.checkout.updated`, and `device.code.paired` where available. Physical device pairing is not claimed in Sandbox; device-code handling is covered by emulation. Refund reconciliation currently uses explicit status checks; refund webhook subscription is not claimed as implemented. [Square webhooks](https://developer.squareup.com/docs/webhooks/overview).
7. Execute OAuth success/denial/replay/refresh/revocation, signed webhook delivery/replay, test payments/refunds and recovery. Save sanitized timestamps, event/payment IDs and exact reconciliation results. Do not save raw tokens, authorization headers or customer payment data.

## Terminal environment distinction

Square states that physical hardware cannot be used in Sandbox. Its current documentation supports Sandbox ListDevices/GetDevice with test IDs; the earlier blanket claim that the Devices API is unsupported is superseded. Sandbox Terminal checkout tests use Square's documented simulated device IDs. Therefore the current pairing UI's local emulator coverage does **not** certify real Sandbox pairing, and a physical Terminal cannot close that gate with a Sandbox device code. [Sandbox testing](https://developer.squareup.com/docs/devtools/sandbox/testing), [Terminal quickstart](https://developer.squareup.com/docs/terminal-api/quickstart).

Physical pairing/payment acceptance remains blocked on hardware **and separate production approval**; do not substitute production credentials to work around Sandbox limitations. Before that phase, review the production provider configuration change and [migration/disable plan](POS_PRODUCTION_MIGRATION_PLAN.md).

Use the [hardware test sheet](POS_HARDWARE_ACCEPTANCE_SHEET.md) for each device/browser combination. Until these gates pass, pilot readiness remains NOT READY.


## External acceptance intake — September 20, 2026 (Arizona)

**PENDING — owner Square setup required.** Phase 7B is accepted and preserved. This pass made documentation changes only; it did not rerun emulation or count old engineering evidence as external acceptance.

- The seven required Square/encryption variables are absent from the current Codex process. No remote deployment secret store was inspected, so this is not a claim about every environment. No dotenv values or secret values were printed or loaded.
- No approved public staging HTTPS origin has been supplied. The previous loopback production-build QA server is not a publicly reachable webhook receiver and intentionally cannot start Square payments. The approved external target must be an isolated development/test runtime with HTTPS and staging Supabase `ukrcbmujzdyclrkghbvo`; do not substitute a production deployment or weaken the runtime guard.
- Code review confirms the fixed Square Sandbox API base and rejection of non-SANDBOX environment/non-Sandbox application IDs. Actual callback/webhook host identity and subscription-key provenance cannot be verified until owner configuration is available; preflight is **PENDING**, not PASS.
- Latest owner-provided hardware availability remains unavailable for scanner, label printer, receipt printer and Terminal. No physical operation was attempted. Manufacturer/model/driver fields remain unverified in the existing hardware sheet.
- Square's [Sandbox overview](https://developer.squareup.com/docs/devtools/sandbox/overview) and [Terminal quickstart](https://developer.squareup.com/docs/terminal-api/quickstart) were rechecked. Physical Terminal pairing/checkout in Sandbox is **NOT AVAILABLE**. Real Sandbox API checkout remains **PENDING** credentials, using documented simulated device IDs. Physical Terminal acceptance remains **PENDING** hardware and a separately authorized supported environment; production remains prohibited.

**Next owner action:** configure the seven variables listed in the setup steps in the approved isolated staging/test runtime's server-side secret store, register the exact OAuth and webhook URLs in the Square application's Sandbox settings, and provide only the staging HTTPS URL and configuration location/readiness confirmation. Do not send secret values. On receipt, resume with environment/URL validation, then request owner consent only when the actual Sandbox authorization page requires it.

For each executed gate, append date/tester, environment, sanitized merchant/location/device/event/transaction IDs, observed result and evidence reference. Retain PENDING until execution, FAIL only for an observed defect, and NOT AVAILABLE for provider-unsupported scenarios. See [current external validation report](POS_EXTERNAL_ACCEPTANCE_VALIDATION.md). No external PASS is recorded yet.
