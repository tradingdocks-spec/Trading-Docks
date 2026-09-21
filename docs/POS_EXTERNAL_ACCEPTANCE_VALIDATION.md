# POS external acceptance validation

Status: **Software acceptance closed September 21, 2026 — real Sandbox and emulated evidence distinguished below.**

Readiness: **ENGINEERING + SQUARE SANDBOX READY / PHYSICAL HARDWARE ACCEPTANCE PENDING**. Pilot readiness: **NOT READY**. Automatic real token refresh remains an observation gate; physical acceptance is incomplete. The [existing checklist](POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md) remains the authoritative gate list; this report does not introduce another acceptance system.

The dated sections below retain historical evidence. The latest results at the end supersede earlier setup-pending statements. Inventory repair remains CLOSED; production remains untouched.

## Evidence collected this pass

Read the accepted [Phase 7B report](POS_PHASE7B_VALIDATION.md), external checklist, hardware sheet and Square configuration/provider code. Branch remains `codex/pos-foundation`. Checked only whether the seven required variables exist in the current process; all are absent. No values were logged, no dotenv file was loaded and no remote secret store was inspected. No staging public HTTPS origin is available in the accepted setup record.

Static configuration fixes the provider base to `https://connect.squareupsandbox.com`, requires `SQUARE_ENVIRONMENT=SANDBOX` and a Sandbox application ID, and requires HTTPS callback/webhook URLs. Actual deployed environment, URL destinations and Sandbox signature-key provenance remain unverified. The previous loopback Next production-build QA server is not a public webhook target and cannot start Square payments. No guard was bypassed.

## External results

| Acceptance area | Result | Evidence / missing prerequisite |
|---|---|---|
| Real OAuth success, denial, invalid/replayed/expired state | PENDING | Owner Sandbox application/configuration and staging HTTPS runtime required; no real OAuth attempted |
| Connection health, token refresh and revocation | PENDING | Requires actual Sandbox authorization; no credentials retrieved |
| Merchant/location retrieval, mapping, tenant denial and immutable history | PENDING | Requires real authorized Sandbox seller/location; existing emulator evidence is not an external pass |
| Square-origin webhook delivery, signature and replay/deduplication | PENDING | Requires publicly reachable notification URL and Sandbox subscription; no provider delivery received |
| Barcode scanner and at least 25 rapid scans | PENDING | No physical scanner available per latest owner report |
| Label printer: 1/5/25/100 labels | PENDING | No physical printer/media available |
| Exact-position printed-label scan-back and stock deduction | PENDING | Requires physical printer plus scanner; critical gate remains open |
| Cash/discount/refund/Square receipt printing | PENDING | No physical receipt printer available |
| Physical Terminal pairing and checkout in Sandbox | NOT AVAILABLE | Square explicitly excludes physical hardware from Sandbox; simulated IDs cannot prove the physical workflow |
| Real Sandbox Terminal API checkout/cancel/decline/reconciliation | PENDING | Requires Sandbox credentials and documented simulated device IDs; no authentic API test attempted |
| Physical Terminal pairing, assignment, health and identity | PENDING | Hardware plus separately authorized provider-supported environment; production is currently prohibited |
| Physical Terminal cancel, customer cancel, busy and close-during-payment | PENDING | No paired physical device or authorized supported environment |
| Browser reload/network interruption recovery | PENDING | Requires real provider operation; physical case additionally needs hardware and supported environment |
| Square refund and response-loss recovery | PENDING | Requires authentic Sandbox transaction; no refund attempted |
| Physical cash sale/refund/close loop | PENDING | Requires scanner/receipt hardware; prior engineering reconciliation retained separately |
| Complete staged counter workflow | PENDING | Physical inventory-to-label-to-scanner-to-payment-to-receipt chain not performed; physical Sandbox Terminal segment unsupported |
| Limited-pilot review | PENDING | Required external evidence incomplete; production rollout review not authorized |

Square's [Sandbox overview](https://developer.squareup.com/docs/devtools/sandbox/overview) and [Terminal quickstart](https://developer.squareup.com/docs/terminal-api/quickstart) were rechecked during intake. A physical Square Terminal cannot be paired or charged in Sandbox. Do not describe simulated device IDs as real hardware evidence or use production credentials to work around this limitation.

## Hardware matrix

The [existing hardware acceptance sheet](POS_HARDWARE_ACCEPTANCE_SHEET.md) remains the single device record. Scanner, label printer, receipt printer and Terminal are PENDING; manufacturer, model, connection, driver, OS and browser have not been physically verified. No paper output or scan-back evidence exists for this pass.

## Defects and regression status

No external application defect has been observed because the external execution prerequisites are absent. The Square physical-in-Sandbox restriction is a provider environment limitation, not an observed product failure. No runtime code, tests, migrations, secrets or deployment settings changed in this pass.

The accepted engineering baseline remains the Phase 7B evidence: 947 root tests, 580 mobile tests, 126 checks per DB variant, 41 hosted dashboard tests, all 58 original browser failures resolved, 34 skips audited, 500 distinct lines and exact 100-transaction reconciliation. These results were **not rerun or reclassified as external evidence**. A fresh `git diff --check` is the validation for these documentation-only edits. If external testing later exposes a code defect, run the requested focused and full Phase 7B regressions after its fix.

## Owner handoff and continuation

The immediate stop condition is **owner configuration of Square Sandbox and identification of the approved public staging/test origin**, as explicitly required by the external acceptance request's sections 3 and 39. Use the exact configuration steps and variable names in the [existing checklist](POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md#owner-square-sandbox-setup). Configure secrets directly in the isolated runtime, not in chat. Return only the staging URL and where the configuration is available. Resume with preflight and OAuth after that information arrives; no automatic background polling or deployment was enabled.

Production Supabase changes, production deployments/authorization, real-money payments/refunds, live tenant enablement and main merge remain prohibited and were not performed. Final classification remains **ENGINEERING READY / EXTERNAL ACCEPTANCE PENDING**, with **pilot readiness NOT READY**.

## Vercel external setup preflight — September 21, 2026

Status: **Partially Implemented — external acceptance blocked by staging runtime configuration.**

Read-only Vercel CLI inspection authenticated as tradingdocks-spec and confirmed project trading-docks-346a (prj_cthg5hX2ehylcwdnPMPw5ASyfRZX).

- PASS: all seven required Square/encryption variable names exist for Preview. Application secret, webhook signature key and credential encryption key are sensitive. No secret values were printed or written to this report.
- PASS: individually decrypted non-sensitive configuration checks confirmed SQUARE_ENVIRONMENT exactly SANDBOX, application ID starts sandbox-, and OAuth redirect matches the owner-supplied Preview origin plus /api/pos/payments/square/callback. These checks establish format/configuration only, not successful Square authorization.
- BLOCKED: origin resolves to deployment dpl_FdFpj411EqkdRZFWZKZnFo1Fweqv, branch codex/fix-vercel-chromium-externalization, commit 121297b2efffe19fc5dadb1e59e63f985178118e. Local Git tree inspection of that commit returned no files under src/app/api/pos or src/app/api/payments/webhooks/square. Accepted POS work remains on local codex/pos-foundation with uncommitted changes.
- BLOCKED: unauthenticated HEAD probes of both callback and webhook paths returned HTTP 302 to vercel.com. Project protection is all_except_custom_domains. Square cannot deliver directly through this login barrier.
- BLOCKED: Preview and Production share the same unscoped Supabase URL, publishable-key and service-role-key records, with no branch-specific overrides shown. Their sensitive values were not decrypted, so database identity is unverified; this configuration does not establish staging isolation. No database calls or authenticated app actions were attempted.
- BLOCKED: current src/lib/pos/payments/server.ts explicitly rejects Square starts with NODE_ENV=production and hides Square sites/terminals in that runtime. The accepted checklist requires an isolated development/test HTTPS runtime. Do not weaken this guard or change NODE_ENV to bypass it.
- PENDING: secret correctness, real Square OAuth consent, signed webhook delivery, Terminal Sandbox API transactions, refunds and reconciliation. No end-to-end PASS is claimed.

No deployments, remote setting changes, database writes, payment requests, production operations or code changes were performed during that preflight. Next work required an approved isolated runtime with staging database identity, accepted POS code, and a public webhook endpoint; a Vercel Preview-compatible guard design required separate architecture review under the existing acceptance scope.

## Authorized staging fixes — September 21, 2026

Owner explicitly authorized staging-only deployment fixes, keeping production untouched. The preflight deployment blockers above are now resolved. Status: **Implemented staging deployment / real Square acceptance PENDING**.

- READY: `https://trading-docks-pos-staging.vercel.app`, Preview deployment `dpl_GhbTtR7pvgvtTXn3Cb49qCbr3eWd`, source `42bcc15` on `codex/pos-foundation`.
- Staging Supabase URL/public key/service-role overrides apply only to that branch. Nine unrelated inherited integration values are blanked on the branch. Production env metadata, active deployment and project protection were verified unchanged.
- Runtime guard pins Preview/project/branch/staging DB/Sandbox configuration/exact callback and webhook URLs. Production and other optimized runtimes fail closed. Mock payments remain disabled.
- Only the dedicated staging alias receives a protection exception. The exact Square webhook route bypasses user-session middleware but still requires a valid Square signature. Its unsigned public request returns 403; anonymous POS/settings/callback requests are denied.
- Deployed browser checks PASS for automated owner and the requested separate staging owner account: real hosted Auth login, owner settings, desktop/mobile render, Sandbox OAuth URL generation with persisted one-time state, emulated denial/replay rejection, mock-payment denial, and manager Square administration denial. These are not a real Square consent/token exchange.
- New owner account has its own Sandbox workspace, register and five sample inventory items. Temporary password remains in an ignored local handoff file. No email was sent.
- One older synthetic staging Auth row with null token strings was repaired without changing its password or privileges; admin user listing now succeeds. No migration or production operation occurred.
- Validation: root TypeScript and 949 unit tests pass; baseline lint 0 errors/534 existing warnings, changed-file lint pass; mobile TypeScript/580 tests pass; both database ledgers 126 groups pass; optimized Vercel build pass; zero error-level deployment logs during the observed test window. Initial upload-exclusion failures were corrected, not counted as passing builds.
- PENDING owner action: edit the existing Square Sandbox OAuth redirect and webhook notification URL to this staging origin, preserving the webhook signature key, then authorize through the staging Payments screen. Credentials are configured but real provider authentication/signature-key correctness is not yet proven.
- Hardware gates remain PENDING; physical Terminal in Sandbox remains NOT AVAILABLE. Pilot remains NOT READY until required external gates pass.

Evidence and disable procedure: [staging deployment](POS_STAGING_DEPLOYMENT.md), `pos-vercel-staging-smoke.json`, `pos-vercel-owner-smoke.json`.


## Resumed external acceptance — September 21, 2026

Inventory schema/backfill blocker is CLOSED by owner acceptance; it is not reopened by this pass. Production remains untouched; no feature development, migrations, deployment or secret changes were performed.

Fresh authenticated staging preflight (`pos-square-external-preflight.json`): Square settings HTTP 200, configured=true, zero connections, zero retrieved locations and zero mappings. Public unsigned webhook is rejected with HTTP 403. This proves receiver reachability and unsigned rejection, not authentic provider delivery/signature verification.

Real OAuth, merchant retrieval, location mapping, webhook delivery, and connection health/revocation remain PENDING. The next dependency is the owner's interactive Sandbox test seller session/consent. Opened the visible Codex browser at staging sign-in for handoff. Square's current OAuth walkthrough requires opening the test seller's Sandbox Dashboard before the authorization URL; direct Sandbox authorization-page login is unsupported. Reference: https://developer.squareup.com/docs/oauth-api/walkthrough . No manufactured token, emulator event, or old test result is counted as real external acceptance. Hardware gates remain PENDING.


## Real Square Sandbox acceptance — September 21, 2026

Inventory blocker remains CLOSED. No runtime feature development, migration, production access changes, or deployment performed.

- Created isolated US seller **Trading Docks POS Acceptance**, with automatic app authorizations disabled. Developer-account sign-in was used only to access Sandbox configuration; no production merchant authorization occurred.
- PASS real OAuth consent, callback/code exchange, merchant verification and locations retrieval at 16:22:39 UTC. Merchant `MLFWZQVCJ9NP9`; active Square location `LZ2H61E38DWB3`.
- PASS mapped staging **Sandbox counter** (`8bda45a8-c316-48a1-988c-1c49f319a945`) to that location. Phoenix Store was left unmapped.
- PASS real Check Connection at 16:23:02 UTC (token-status and locations provider requests).
- PASS real Sandbox revoke through the existing authenticated staging endpoint; UI confirmed DISCONNECTED. Browser confirmation automation stalled, so the authorized acceptance action used the existing API. Reauthorized the same seller at 16:26:59 UTC; connection and mapping restored.
- PASS subscription destination matches staging, enabled, API version 2026-09-16, five expected event types. Subscription `wbhk_ecbab9e4089f48f690d7c10a48d34377`.
- PASS Square-origin canned test delivery/signature verification: event `84ccdb8a-da90-4b14-b6b0-c5a5abbccfe6` recorded RETRY, HTTP 503. This canned device event belongs to an unrelated example merchant/device, so it cannot certify successful payment reconciliation and was not treated as a payment failure.
- PASS actual Sandbox test payment through the existing guarded staging payment API using server-owned Square test nonce; no real card or funds. Amount 109 USD cents, payment attempt `ef654e41-d9a2-4e79-a7b9-bf2ca8299528`, Square payment `TNG0hKWw8LR5LCyRBmUlb5O7ZtMZY`, sale `e4e3ce2b-29c7-4f86-bf39-73d44f502d54`; SUCCEEDED/COMPLETED. Exactly one sale exists. Dedicated acceptance register closed with counted cash zero.
- PASS authentic payment webhooks: `payment.created` event `6a0af92f-abdd-3234-a72e-de6462ad0ec6` PROCESSED at 16:30:14 UTC and `payment.updated` event `b9a54c26-fe9f-3722-9e78-a921b14f8e8b` PROCESSED at 16:30:16 UTC, matching the actual test merchant/payment. Signature verification precedes event persistence. Fresh unsigned request remains HTTP 403.

Evidence: `pos-square-external-preflight.json`, `pos-square-real-payment.json`, and read-only staging event/sale verification. No tokens or signature secrets saved in evidence.

Remaining external gates include provider replay/out-of-order delivery, forced token refresh/expiry, refunds and failure-recovery scenarios, and simulated Terminal API checks. Current scopes are merchant-profile read and payment read/write; Terminal scope has not been enabled. Physical hardware gates remain PENDING; physical Terminal in Sandbox remains NOT AVAILABLE. Overall external acceptance remains PARTIAL, pilot NOT READY. Production remains untouched.

## Remaining payment acceptance — September 21, 2026

Acceptance only on `https://trading-docks-pos-staging.vercel.app`, Supabase `ukrcbmujzdyclrkghbvo`, merchant `MLFWZQVCJ9NP9`. No runtime changes, migrations, deployment, production access or secret changes in this pass.

- PASS authentic replay: Square event `6a0af92f-abdd-3234-a72e-de6462ad0ec6`, original 1,567-byte payload and original provider signature replayed twice to staging. Both returned HTTP 200. Read-only database audit confirms one PROCESSED event retaining its original `2026-09-21T16:30:14.494371Z` processing time. The original sale remains unique. Raw payload/signature are excluded from committed evidence.
- PASS real payment with browser response loss: Playwright allowed the staging request to finish against Square, observed HTTP 200, then aborted delivery to the browser. After navigation/reload, identical-key retry and provider check returned the same sale `202130e1-9ae3-44d7-95a7-b1a0b1dcf14f`, Square payment `tYTX1rUfdSaZG7w7KtV0ytS0zUEZY`, 109 USD cents. Stock deducted once.
- PASS real refund with browser response loss: same response-discard/reload/identical-key technique; provider reconciliation reached SUCCEEDED with recovery_required=false. Local refund `4e751e89-fc2a-4206-9e37-0d0ab23df536`, amount 109 cents; exactly one refund and one stock restoration. Repeated status checks retained the same refund ID.
- PASS cash regression: sale `4291849f-f71d-4985-84d8-0e8b705d81fd`, 109 cents. Session `79ec07d5-4798-4122-84c9-e036bf951d59` closed, expected and counted cash 109, variance zero. Stock was 19 before this pass and 18 afterward, matching the net one cash unit sold.
- PASS final reconciliation assertions: canonical read-only query found three unique sales, each with one tender and matching receipt/tender/sale totals of 109 cents; one refund of 109 cents. Daily totals 327 sales - 109 refunds = 218; 109 cash + 109 net Square = 218. Both acceptance register sessions closed with zero variance. Connection remains CONNECTED.

Limits: response-loss injection covers browser-to-staging delivery after successful server processing, not loss between Square and the staging server. The latter retains prior emulation evidence only. Reload recovery was exercised through the existing authenticated APIs with retained request keys; this is not evidence of a physical Terminal or automatic reconstruction of an unsaved cart. Real reauthorization was already accepted PASS. Automatic token rotation was not forced: the current token expires `2026-10-21T16:26:58Z`, and the implementation's 23-day threshold makes refresh eligible approximately September 28. No database expiry edits, migration bypass, credential extraction or new force-refresh feature were used.

Evidence: `pos-square-authentic-replay.json`, `pos-square-recovery-acceptance.json`, `pos-square-final-reconciliation.json`. A Node assertion pass compared receipts, canonical tenders/refunds, event timestamp, inventory delta, daily report and drawer variances successfully. Existing unrelated dirty files were preserved.

Readiness remains **ENGINEERING READY / EXTERNAL ACCEPTANCE PENDING** because the broader checklist retains unexercised provider scenarios, including simulated Terminal API acceptance. Requested payment/refund/replay/cash checks pass within the explicit limits above. Hardware gates remain PENDING; pilot remains **NOT READY**. Do not relabel an unexecuted gate PASS merely to advance readiness.


## External acceptance closure — September 21, 2026

This entry supersedes the previous broader-pending classification under the owner's explicit acceptance of deterministic emulation for remaining software contracts. Accepted real Sandbox passes remain unchanged. No hosted mutation, credential change, new feature, deployment or production operation was performed in this closure pass.

Fresh execution:

- `node --test --experimental-strip-types tests/pos-square.test.ts tests/pos-terminal.test.ts tests/pos-square-runtime.test.ts tests/pos-payment-budget-recovery.test.ts`: 26/26 PASS.
- `node tests/pos-db.mjs --browser`: 128 database groups PASS plus browser scenarios, including Terminal pairing/assignment, approval receipt, cancel, decline/cash fallback, lost-response reload, busy/history/tablet and zero runtime errors.
- `node tests/pos-db.mjs` and `node tests/pos-db.mjs --enum-ledger`: 128/128 groups each after added response-loss/refund uniqueness and stale refresh-save assertions.
- Changed-test ESLint PASS. No runtime source changed. Databases were disposable loopback PostgreSQL, not hosted staging or production; fixtures do not load application dotenv files.

**EMULATED PASS — Square-to-server response loss:** the real application Square HTTP adapter, provider, orchestrator and database functions run against a deterministic fetch implementation. The simulated provider stores a COMPLETED payment/refund under its idempotency key before throwing a transport error. The application initially retains an unresolved attempt. Recovery reuses the original identity, retrieves the existing simulated provider object and finalizes once. Assertions cover one remote payment/refund, one sale/refund, concurrent payment reconciliation, stable receipt/refund identity and stock/cash effects. This is provider-boundary simulation, not a claim that real Square networking was interrupted.

**EMULATED PASS — Terminal contracts:** `tests/pos-terminal.test.ts`, `tests/pos-terminal-db.mjs`, `tests/square-terminal-emulator.mjs` and `tests/pos-terminal-browser.mjs` exercise device-code creation/status/expiry, authoritative paired observation, checkout creation/retrieval/cancellation, conservative normalization, signed webhook duplicate/out-of-order processing, device/location/register/tenant validation, idempotency, browser reload and unresolved-checkout register-close rejection. The API boundary is emulated; actual hardware and live Square Terminal HTTP calls were not exercised. Square supports Sandbox checkout test IDs, but no artificial paired device was inserted into hosted staging to bypass its validation.

**EMULATED PASS — refresh:** successful token refresh persists ciphertext under the winning lease; lease losers do not issue refresh; failed provider authentication marks attention; the database allows one lease and ignores stale saves without overwriting the winning credential version. The added stale-save test initially expected an exception; inspection confirmed the intentional empty-result/no-op contract. The assertion was corrected to check no mutation, and both ledger runs passed. Only disposable synthetic credential timestamps were adjusted by the pre-existing fixture. The real staging credential was unchanged.

**REAL AUTOMATIC TOKEN REFRESH: PENDING — token not yet due.** Recorded real expiry is October 21 at 16:26:58 UTC, with the 23-day refresh threshold approximately September 28. This is a time-based observation gate, not an engineering defect. Actual rotation is not claimed PASS.

Documentation correction: current Square documentation supports Sandbox ListDevices/GetDevice using test values; older blanket statements that all Devices API behavior is unavailable were too broad. Physical hardware remains unsupported in Sandbox. Sources checked September 21: [Sandbox testing](https://developer.squareup.com/docs/devtools/sandbox/testing), [Sandbox limitations](https://developer.squareup.com/docs/devtools/sandbox/overview). Device-code behavior is specifically labeled emulated rather than claiming live pairing.

Final classification: **ENGINEERING + SQUARE SANDBOX READY / PHYSICAL HARDWARE ACCEPTANCE PENDING**. Pilot readiness **NOT READY** until the intended scanner, label printer/scan-back, receipt printer and Terminal are physically tested. Production remains untouched. Inventory blocker remains CLOSED. The current closure matrix in the checklist is authoritative; earlier dated PENDING entries are historical evidence.
