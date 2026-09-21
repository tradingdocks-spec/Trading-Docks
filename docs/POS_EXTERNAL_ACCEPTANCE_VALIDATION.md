# POS external acceptance validation

Status: **Partially Implemented — external validation awaiting owner setup.**

Readiness: **ENGINEERING READY / EXTERNAL ACCEPTANCE PENDING**. Pilot readiness: **NOT READY**. This is an interim evidence report, not completed external acceptance. The [existing checklist](POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md) remains the authoritative gate list; this report does not introduce another acceptance system.

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
