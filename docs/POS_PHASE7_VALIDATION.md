# Phase 7 POS validation

Status: **Partially Implemented. Classification: NOT READY for a real-store pilot.** Evidence collected September 20, 2026 Arizona / September 21 UTC on `codex/pos-foundation`. Production rollout remains unapproved. The core hosted cash path passed, but this report does not close every engineering acceptance gate.

## Phase 7B superseding assessment

The original Phase 7 assessment below is retained as historical evidence. [Phase 7B](POS_PHASE7B_VALIDATION.md) closes the engineering blockers: 500-line carts, exact scale/shift reconciliation, search guard, permission/throttle regression, browser failure/skip cleanup and refreshed hosted/build/print validation.

**Current: ENGINEERING READY / EXTERNAL ACCEPTANCE PENDING. Pilot readiness remains NOT READY.**

| Blocker category | Current remaining work |
|---|---|
| ENGINEERING | Zero unresolved critical blockers within Phase 7B acceptance scope; all original 58 browser failures resolved, hosted dashboard 41/41 |
| EXTERNAL ACCOUNT | Real Square Sandbox application/merchant, OAuth and signed webhook delivery, Sandbox Terminal API acceptance |
| PHYSICAL HARDWARE | Scanner, label/receipt/Letter printers, label scan-back, Terminal/network interruption |
| PRODUCTION APPROVAL | Separate migration/deployment/provider review, restore rehearsal and live tenant enablement; not authorized |

See [external checklist](POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md) and [hardware sheet](POS_HARDWARE_ACCEPTANCE_SHEET.md). Historical FAIL/NOT TESTED rows below are not the current Phase 7B gate matrix; production preflight and external limitations remain explicit in the newer report.

## Evidence and scope

- Hosted staging: `ukrcbmujzdyclrkghbvo`, PostgreSQL 17.6; real Auth users with independent JWT sessions. Synthetic workspaces/data are retained for investigation. Credentials are ignored under `.local-fixtures/` and must never be committed.
- [Migration manifest](pos-phase7-migration-manifest.json), [rehearsal results](pos-phase7-migration-rehearsal.json), [prerequisite drift](pos-phase7-prerequisite-drift.json).
- [Hosted assertions](pos-phase7-hosted-results.json), [direct security checks](pos-phase7-hosted-security.json), [performance](pos-phase7-performance.json), [query plan](pos-phase7-query-plan.json).
- Actual Next.js production build on loopback HTTPS connected to staging: [Chrome](pos-phase7-hosted-browser-chrome.json), [Edge](pos-phase7-hosted-browser-msedge.json), [WebKit](pos-phase7-hosted-browser-webkit.json), [delegated employee and manager](pos-phase7-hosted-browser-chrome-delegated.json). This is not a publicly deployed webhook endpoint.
- [Table audit](pos-phase7-table-audit.json), [function audit](pos-phase7-function-audit.json), [advisors](pos-phase7-advisors.json), [secret scan](pos-phase7-secret-audit.json).

## Discovered issues and changes

A hosted regression found that a linked `member` employee with `pos.sell=false` could still search delegated inventory. The ordinary-member default bypassed the employee permission record. `20260921010637_pos_employee_permission_precedence.sql` makes linked employee permissions take precedence; unlinked ordinary members keep their existing default. The same hosted JWT regression now returns POS_FORBIDDEN. See [before/after regression result](pos-phase7-staff-permission.json). Local staff tests now exercise the hosted `member` role, and the own-label cashier fixture explicitly grants selling permission.

Actual hosted cash acceptance also injected a lost response after the server committed checkout. Reload and Check checkout status recovered the original sale; the drawer closed at the independently expected total after a second manager-approved sale. After reload, the operator must select the intended register for a new sale.

Actual browser acceptance also found that the shared route capability admitted free-tier `employee` staff but redirected hosted `member` staff to plans. Route eligibility now recognizes both roles; database checks still enforce employee permission, paid inventory owner and site delegation. The hosted employee UI, live revocation and independently authenticated manager approval now pass. No inventory ownership or management capability was broadened.

Implemented a forward migration and server checks for committed provider budgets: OAuth 12/minute, device 60/minute, payments 120/minute per actor across workspaces. No caller-selected actor or arbitrary bucket is accepted. Exhaustion returns false so the counter commits. Database errors fail closed before provider work. An actual concurrent hosted test admitted exactly 12 of 15 OAuth requests and denied the next request.

The existing 100-line cart limit rejects 250 lines. It was not silently expanded during the feature freeze. Hosted 10,000-row name/set/location searches initially timed out after eight seconds. Query analysis traced repeated owner authorization across every inventory row. `20260921014756_pos_search_authority_scope.sql` materializes authorized mapped locations once per statement, retaining the same permission function and checkout locks. Hosted authenticated retests now take 274–288 ms for broad search and 146 ms for exact SKU. Both ledger variants still pass 122 groups. See [before](pos-phase7-performance-large-before.json), [after](pos-phase7-performance-large.json) and [query plans](pos-phase7-search-query-review.json). Complete accessibility/failure matrices and an extended real shift remain open. These engineering gaps prevent the stronger ENGINEERING READY/HARDWARE PENDING classification.

The accelerated 100-sale browser shift reconciled stock and drawer. Live elements stayed at 80 and listeners at 169 from transaction 25 through 100. An initial aggregate node threshold failed: The final isolated run reported 289 nodes at 25 sales and 439 at 100. A heap snapshot traced retained text nodes to native editing `UndoStep → UndoStack → Editor`, not growing application DOM or scanner listeners. The corrected acceptance assertion measures live application elements/listeners while preserving aggregate measurements. See [shift measurements](pos-phase7-browser-shift.json) and [heap review](pos-phase7-heap-review.json). No application memory workaround or undo-history removal was introduced. An unpaced synthetic loop also hit the intentional request limit; the shift uses one-second operator pauses.

Hosted constraints differed from simplified local fixtures: membership override is `business` (mapped to `store`), and employees have workspace role `member`. Fixture data was corrected; no membership or ownership boundary was weakened. Initial loopback browser POSTs used 127.0.0.1 while Next normalized the origin to localhost; rerunning through direct HTTPS at localhost passed without changing application CSRF code. A local self-signed certificate caused a brand-image fetch warning; this is not a POS authorization failure. Initial animated sign-in click stability was avoided with reduced motion and keyboard activation, consistent with existing browser fixtures.

## Pilot matrix

| Gate | Status | Evidence / remaining work |
|---|---|---|
| Hosted Supabase migrations | PASS | Seven original plus three forward migrations |
| Hosted Auth | PASS | Seven real identities |
| RLS tenant isolation | PASS | Direct JWT/anonymous requests and grant audit |
| Employee delegation | PASS | Sale attribution, manager denial and revocation |
| Cash checkout | PASS | Hosted RPC and actual Next.js UI |
| Cash refund | PASS | Hosted idempotent return; broader variants local |
| Register close | PASS | Five independently summed drawers; hosted UI close |
| Barcode scanner | PENDING | External physical hardware required |
| Label printer / scan-back | PENDING | External physical hardware required |
| Receipt printer / normal printer | PENDING | External physical hardware required |
| Square Sandbox OAuth | PENDING | External Sandbox app/merchant required |
| Square webhook HTTPS delivery | PENDING | External credentials and deployed notification URL required |
| Terminal pairing/payment | PENDING | External setup/hardware; Sandbox emulator is not physical hardware |
| Terminal recovery | PENDING | Local emulation PASS; physical/network acceptance pending |
| Security audit | PENDING | Core automated checks PASS; complete hostile-value/failure/logging acceptance remains open |
| Performance | FAIL | 10,000-row search and 100-sale accelerated browser shift pass; 250-line carts remain unsupported. |
| Web build | PASS | Production build and staged build |
| Mobile build | PASS | Expo web/iOS/Android export; no physical device certification |

## All requested gates

PASS below describes only the stated evidence. NOT TESTED means some required portion remains untested; local emulation never substitutes for an external gate. Hardware/Square NOT TESTED rows map to PENDING in the pilot matrix, not FAIL.

| # | Gate | Result | Evidence / limitation |
|---|---|---|---|
| 1 | FREEZE FEATURE SCOPE | PASS | Feature scope frozen; only request-budget safety control added. |
| 2 | AUDIT ALL PHASE 1–6 MIGRATIONS | NOT TESTED | Nine-file manifest, prerequisite drift, function/table audits. Limited prerequisite comparison; production preflight still required. |
| 3 | HOSTED SUPABASE STAGING | PASS | Isolated ukrcbmujzdyclrkghbvo; production received no mutations. |
| 4 | STAGING MIGRATION REHEARSAL | PASS | Seven accepted migrations plus forward request-budget, employee-permission and search-authority migrations applied successfully. |
| 5 | MIGRATION IDEMPOTENCY / DRIFT CHECK | NOT TESTED | 44 tables and 52 functions inspected; no browser table grants or private-function grants. Complete cross-project schema equivalence not established. |
| 6 | HOSTED AUTH VALIDATION | PASS | Seven actual password-authenticated staging JWT identities. |
| 7 | OWNER INVENTORY TEST | PASS | Hosted search, keyboard scan, cash checkout, receipt and register close passed; refund tested by hosted RPC. |
| 8 | DELEGATED EMPLOYEE TEST | PASS | Delegated sale retains inventory owner and records separate employee actor. |
| 9 | NON-DELEGATED EMPLOYEE TEST | PASS | Hosted nondelegated employee owner-stock search denied. |
| 10 | MANAGER BOUNDARY TEST | PASS | Hosted manager without delegation denied. |
| 11 | CROSS-TENANT TEST | PASS | Hosted direct REST/RPC denial across POS/payment/refund/Terminal/Square/labels. |
| 12 | ANONYMOUS TEST | PASS | Anonymous hosted RPC and actual Next.js APIs denied. |
| 13 | RLS AUDIT | PASS | 44 POS tables RLS enabled; direct anonymous/authenticated access revoked. See table/function artifacts. |
| 14 | SECRET EXPOSURE AUDIT | PASS | Browser bundles, local logs and changed/nonignored files scanned (current count in secret-audit artifact); no known staging privileged keys/passwords or secret-key pattern. Live Square material unavailable. |
| 15 | SQUARE SANDBOX CONFIGURATION | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 16 | REAL SQUARE SANDBOX OAUTH TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 17 | OAUTH FAILURE TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 18 | TOKEN REFRESH TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 19 | SQUARE REVOCATION TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 20 | SQUARE LOCATION MAPPING | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 21 | WEBHOOK PUBLIC-ENDPOINT TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 22 | WEBHOOK REPLAY TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 23 | WEBHOOK ORDERING TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 24 | PHYSICAL BARCODE SCANNER QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 25 | RAPID SCAN TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 26 | BARCODE MISREAD TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 27 | PHYSICAL LABEL PRINTER QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 28 | LABEL SCAN-BACK TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 29 | SMALL LABEL TEST | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 30 | RECEIPT PRINTER QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 31 | STANDARD PRINTER FALLBACK | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 32 | TOUCHSCREEN QA | NOT TESTED | 1024 x768 simulated viewport passed; no physical touchscreen tested. |
| 33 | KEYBOARD-ONLY QA | NOT TESTED | Hosted keyboard-driven cash flow passed; complete unassisted tab/focus audit remains open. |
| 34 | REAL SQUARE TERMINAL SANDBOX QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 35 | PHYSICAL TERMINAL PAYMENT QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 36 | TERMINAL CANCEL QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 37 | CUSTOMER CANCEL QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 38 | TERMINAL BROWSER-RELOAD QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 39 | TERMINAL NETWORK INTERRUPTION QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 40 | TERMINAL DEVICE-BUSY QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 41 | TERMINAL REGISTER-CLOSE QA | PENDING | External Square setup or physical hardware required. Local fixtures do not certify this gate. |
| 42 | CASH END-TO-END REAL QA | NOT TESTED | Hosted opening floats, sales/refund, paid-in/out, cash drop and zero-variance closes passed. Physical drawer/count remains PENDING. |
| 43 | REFUND REAL WORKFLOW QA | NOT TESTED | Hosted cash refund/retry/restock passed; partial/no-restock and provider refunds passed local suites. Live Square pending. |
| 44 | PRICE OVERRIDE QA | NOT TESTED | Local override authority/original-price regression passed; real separate-user browser override not tested. |
| 45 | MANAGER APPROVAL QA | PASS | Real separate cashier/manager browser sessions: request, manager approval and original employee checkout passed; hosted decision attribution also verified. |
| 46 | DELEGATION REVOCATION QA | PASS | Owner revocation from an independent hosted session denies the existing employee browser cart; restoring access permits checkout with correct owner and cashier attribution. |
| 47 | REGISTER CONCURRENCY QA | PASS | Hosted checkout/close reconciles committed cash and sale count; competing closes emit one immutable REGISTER_CLOSE. Paid-out retry also passed. |
| 48 | LAST-ITEM RACE QA | PASS | Hosted two-register last-item race: exactly one sale, zero remaining. |
| 49 | MARKETPLACE RESERVATION QA | PASS | Hosted canonical marketplace reservation versus POS race: one winner; stock covers reservations. |
| 50 | LARGE CART PERFORMANCE | FAIL | 25/100 quotes, checkout and receipt measured. 250 returns POS_INVALID at current 100-line limit; large-cart UI timing not certified. |
| 51 | LARGE INVENTORY SEARCH | PASS | 10,000-row hosted name/set/location searches corrected from timeout to 274–288 ms; exact SKU 146 ms. Scope is this synthetic inventory size. |
| 52 | LARGE LABEL JOB | PASS | 250/500/1000 PDFs passed exact pagination and dimensions; 1000 labels 1614 ms. No physical printing. |
| 53 | DATABASE QUERY REVIEW | PASS | Hosted EXPLAIN identified per-row permission work; materialized owner/location checks reduced measured predicate 10,713 ms to 101 ms, and authenticated RPC retest passed. No speculative index added. |
| 54 | LOAD / BURST TEST | NOT TESTED | 100 hosted cash checkouts across five concurrent registers passed. Combined search/history/provider burst not yet certified. |
| 55 | API RATE LIMIT REVIEW | NOT TESTED | New committed per-actor budgets gate outbound OAuth/device/payment work; actual hosted 15-call atomic budget test passed. Cash/search existing 600/minute budget reviewed; public webhook infrastructure throttling remains an operational concern. |
| 56 | SECURITY REVIEW — AUTHORIZATION | PASS | Hosted tenant/owner/delegation boundaries and local arbitrary-ID/approval regressions passed; no external penetration test claimed. |
| 57 | SECURITY REVIEW — PAYMENTS | NOT TESTED | Local duplicate/unknown/replay/signature/OAuth state and payment-refund recovery regressions passed. Live Square gates pending. |
| 58 | SECURITY REVIEW — CASH | PASS | Immutable cash ledger/closed sessions, self-approval denial and drawer reconciliation covered by local DB and hosted tests. |
| 59 | SECURITY REVIEW — PRINTING/BARCODE | NOT TESTED | Receipt/label escaping unit tests and authorization boundaries passed; printed scan-back pending. |
| 60 | XSS TESTING | NOT TESTED | Existing hostile product/site/label escape tests pass; explicit hostile customer/notes/reasons/footer browser matrix remains open. |
| 61 | CSRF REVIEW | PASS | Actual authenticated Next.js cross-origin POS/payment/Square/device POSTs denied; callback uses single-use state. |
| 62 | LOGGING REVIEW | NOT TESTED | Local staging-app logs and bundles scanned. Deployed Square logs unavailable; no live Square secrets were configured. |
| 63 | ERROR UX REVIEW | NOT TESTED | Local browser payment/stock/unknown status recovery messages covered. Hosted post-commit response loss/reload recovers the original sale. DB outage and all user-facing failure cases are not exhaustively injected. |
| 64 | FAILURE INJECTION | NOT TESTED | Local real-SQL provider emulation covers timeout, finalization failure, retry, webhook duplication and reload; physical network interruption pending. |
| 65 | PAYMENT-SUCCESS / LOCAL-FAILURE DRILL | PASS | Provider-success/local-failure retry passed in local SQL/orchestrator/browser acceptance; no second charge. |
| 66 | REFUND RESPONSE-LOSS DRILL | PASS | Local refund response-loss/reconcile passed with one provider refund. |
| 67 | DISASTER RECOVERY REVIEW | NOT TESTED | Support runbook documents diagnosis and preservation; production restore rehearsal not performed. |
| 68 | SUPPORT TOOLING | PASS | Existing Check Status/Retry Finalization/reconcile controls retained; no force-paid override introduced. |
| 69 | POS HEALTH CHECK | PASS | No new readiness screen; optional and omitted to preserve feature freeze. |
| 70 | PILOT SETUP CHECKLIST | PASS | Operational pilot checklist supplied. |
| 71 | OWNER DOCUMENTATION | PASS | POS_PILOT_SETUP.md. |
| 72 | INTERNAL SUPPORT RUNBOOK | PASS | POS_SUPPORT_RUNBOOK.md. |
| 73 | SECURITY/ACCEPTANCE REPORT | PASS | This report and machine-readable evidence. |
| 74 | PILOT GATE MATRIX | PASS | Pilot matrix below; external gates remain PENDING. |
| 75 | DO NOT MARK HARDWARE PASS WITHOUT HARDWARE | PASS | No physical hardware PASS claimed. |
| 76 | DO NOT MARK SQUARE OAUTH PASS WITHOUT REAL SANDBOX AUTH | PASS | Real OAuth remains PENDING. |
| 77 | PILOT READINESS CLASSIFICATION | PASS | NOT READY: remaining engineering acceptance gaps plus external setup/hardware. |
| 78 | LIMITED PILOT RECOMMENDATION | PASS | No real-store pilot recommendation yet. Future scope requires named tested hardware, one store and designated staff. |
| 79 | FEATURE FLAGS | PASS | Default-off schema and disabled-feature local regressions pass; only synthetic staging workspace explicitly enabled. |
| 80 | ROLLBACK PLAN | PASS | Forward-only disable/recovery plan; preserve financial history. |
| 81 | DATA RETENTION | PASS | Local disable/recovery/immutable-history tests pass; no destructive rollback. |
| 82 | PRODUCTION MIGRATION PLAN | PASS | Exact hashed order, prerequisites, backup assumptions, checks and disable plan documented; not executed. |
| 83 | PRODUCTION SQUARE PLAN | PASS | Separate production Square plan documented; Sandbox-only implementation remains guarded. |
| 84 | OBSERVABILITY CHECK | PASS | Safe-ID payment logs and canonical metadata available; no raw tokens logged in tested workflows. |
| 85 | ALERTING RECOMMENDATIONS | PASS | Alert recommendations documented; no monitoring platform or messages configured. |
| 86 | ACCESSIBILITY QA | NOT TESTED | Keyboard-driven flow, responsive layout and labels exercised; full screen-reader, contrast and touch-target audit remains open. |
| 87 | BROWSER QA | PASS | Actual hosted flow passed Chrome, Edge and WebKit. WebKit is not physical Safari/iOS certification. |
| 88 | SCREEN SIZE QA | PASS | 1920 x1080, 1366 x768 and 1024 x768 register layouts plus 375 x812 manager register screen passed without horizontal overflow; physical touch QA pending. |
| 89 | LONG SHIFT QA | PASS | Accelerated 100-sale browser shift reconciled stock/drawer with stable live DOM/listeners; native undo-history growth analyzed. An eight-hour physical shift is not certified. |
| 90 | 100-TRANSACTION SIMULATION | NOT TESTED | 100 mixed local real-SQL sales (50 cash/50 mock) plus 100 hosted cash sales; browser 100-transaction mixed shift remains open. |
| 91 | ACCOUNTING TOTAL RECONCILIATION | PASS | Mixed shift exact minor units: gross 10000, discount 1250, tax 775, refund 54, net 9471, cash 4021, card 5450, drawer 24021. |
| 92 | INVENTORY RECONCILIATION | NOT TESTED | Mixed shift parent stock 200-100+1=101; local exact positions/batches/reservations covered separately, not one combined shift. |
| 93 | RECEIPT RECONCILIATION | PASS | Canonical sale receipts and declined/canceled attempts covered by DB/browser suites; 100-sale receipt presence checked hosted. |
| 94 | PROVIDER RECONCILIATION | NOT TESTED | Emulated Square canonical IDs and orphan recovery covered; real Square reconciliation PENDING. |
| 95 | FINAL FULL REGRESSION | FAIL | Root 942/mobile 580, DB 122 per ledger, POS browser/shift, receipts 18, labels 10 plus six presets, Chaos print 30, builds/exports passed. Broader E2E: 172 passed, 58 failed, 34 skipped; see baseline evidence below. |
| 96 | DO NOT HIDE PRE-EXISTING FAILURES | PASS | Root 534/mobile 3 lint warnings; clean-HEAD browser failures and test-transport failures are explicitly disclosed below. |
| 97 | PHASE 7 DEFINITION OF DONE | NOT TESTED | Open gates prevent full Phase7/pilot acceptance; this is an evidence report, not signoff. |
| 98 | STOP CONDITIONS | PASS | No production mutation/deployment/merchant consent/real money/main merge/customer exposure. |

## Security review

Public POS financial/configuration tables are RPC-only and sensitive; private credentials, OAuth state, provider observation and authority-permit tables are service/internal-only. None of the 44 tables is public-safe/browser-readable. All have RLS with direct anon/authenticated grants revoked. Public authorized RPCs use empty search paths and explicit actor/workspace checks; private helpers are not executable by browser roles. Service-only Square RPC remains inaccessible to both anonymous and ordinary authenticated identities. Label public-safe resolution is a separate existing surface, not a grant to financial records.

Reviewed threats: IDOR, tenant crossing, owner/delegation bypass, manager self-approval, forged register/device/provider IDs, duplicate charge/refund, unknown retries, OAuth state replay/open redirects, spoofed/out-of-order webhooks, mutable cash history and unescaped receipt/label values. Existing real-SQL and emulator regressions cover these boundaries; see Phase6 validation for individual tests. This is an engineering review, not an independent penetration test.

Hosted advisors report intentional RLS-without-policy tables (RPC-only), executable security-definer function notices and an existing leaked-password-protection warning. Do not automatically grant table policies to remove those notices. Review each exposed function and retain restricted grants. The Auth configuration warning remains open for pilot setup; no Auth setting changes were made. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). No production Auth settings were changed.

## Regression and reproducibility

Root TypeScript/build and 942 tests pass; root ESLint has 0 errors/534 warnings. Mobile TypeScript, 580 tests, ESLint 0 errors/3 warnings and Expo web/iOS/Android exports pass. The full root suite includes inventory, Chaos Sort, Label Studio, Orders Center and marketing tests. Both disposable Postgres ledger variants pass 122 groups including 100 mixed transactions per variant. The standard POS browser run passes 122 groups and all phase 1–6 flows; added hosted flows exercise actual Next.js routes. Receipt PDFs: 18; label PDFs: 10 plus six preset screenshots; Chaos print: 30 across Chrome/Edge. Build/export is not native-device QA. The additional shift acceptance probe is reported separately and must not be counted as passing from the standard browser command.

Run `npm run test:pos:db`, `npm run test:pos:browser`, `npm run test:pos:print`, `npm run test:labels:print`, and `npx playwright test --config playwright.print.config.ts`. Hosted scripts require the explicitly guarded ignored staging key/identity manifests; never substitute an app dotenv file. `tests/pos-staging-app.mjs` builds and serves staging on loopback; stop it after acceptance. Hosted performance upserts only its synthetic fixture inventory. Do not run against any real store. Test runs retain immutable synthetic financial records, including earlier diagnostic runs; accounting assertions scope by run/session/sale IDs.

The broader `npm run test:e2e` run is **FAIL: 172 passed, 58 failed, 34 skipped** (264 cases). This is not included in the POS-specific pass count. Failures are in homepage sample expectations, artwork loading, the market SSR fixture and a visual baseline. The existing SSR test hard-coded `http://localhost:4186` even though the suite serves loopback HTTPS on port 4173; this line is present in pre-Phase-7 HEAD `09bf765`. The test now uses Playwright's configured base URL. Generic authenticated dashboard cases and some visual cases were skipped by their existing configuration; they are not passes. The custom Phase 7 hosted tests independently exercise actual POS Auth and routes.

## Next acceptance work

Resolve 250-line scope explicitly, complete full accessibility/hostile-value/failure UX matrices and the combined mixed-tender browser shift. Browser memory review, two-browser approval/revocation and hosted register races are now covered. Then supply Sandbox setup and physical hardware to close external gates. Do not enable a real-store pilot until these gates are reviewed. Use [pilot setup](POS_PILOT_SETUP.md), [support runbook](POS_SUPPORT_RUNBOOK.md) and [production/disable plan](POS_PRODUCTION_MIGRATION_PLAN.md).
