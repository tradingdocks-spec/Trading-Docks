# Phase 7B validation

Status: **ENGINEERING READY / EXTERNAL ACCEPTANCE PENDING** on `codex/pos-foundation`. Production remains untouched. External Square and hardware acceptance remains PENDING; this report does not authorize a pilot.

## Browser regression closure

The original run had 172 passes, 58 failures and 34 skips. A detached baseline at `09bf765` ran the same 264 cases: 190 passes, 40 failures and 34 skips. Application/test sources were unchanged; the baseline build used webpack because the shared node_modules junction is outside that worktree's root. Each original failure has exact project/test evidence in [classification JSON](pos-phase7b-browser-failure-classification.json). Baseline reproduction and source history distinguish stale assertions from nondeterministic tests; no blanket waiver was used.

The accepted interactive marketing demo (`e3f6fd3`) replaced the obsolete three-row sample table. The two homepage image baselines originated before that redesign (`36182a6`) and were reviewed visually before replacement. Pricing snapshots were unchanged. SSR tests now use the configured HTTPS origin; image matrices have a budget covering all 20 combinations; motion is disabled for static artwork checks; timer tests scroll the observed feed into view; artwork fallback permits less than one CSS pixel of browser rounding. The live-feed layout test waits for fonts and asserts exact offsetHeight, excluding composited bounding-box scaling. Theme checks wait for DOM readiness and actual controls rather than unrelated asset loading. No marketing product behavior was changed to satisfy tests.

Final public run: **229 passed, one failed, eight credential placeholders skipped**. The sole remaining live-price WebKit bounding-box assertion was corrected as described above and then passed **16/16** (twice in all eight projects). All 58 original failures passed in the full run; there are no unexplained public failures. The broad run and targeted final retest are reported separately, not combined into a fictitious all-green full run. Classification totals: C=8 environment, D=10 expectation drift, G=40 nondeterminism, A/B/E/F=0.

[Skip audit](pos-phase7b-skipped-test-audit.json): 21 duplicate visual-baseline instances and five mobile-menu cases on desktop are filtered before collection; their applicable projects still execute. Eight credential placeholders are covered by the separate guarded hosted Auth suite. Public tests never receive staging credentials. The hosted suite verifies loopback server project/build identity before signing in.

## Cart scale and atomicity

Supported acceptance target: **500 distinct cart lines**, with a **256 KiB streamed request ceiling**. The prior ceiling was actually 100 lines in PostgreSQL plus 32 KiB HTTP/RPC bounds; 250 was the failed acceptance target, not an implemented limit. At 500 lines, the measured intent exceeds 32 KiB. The forward migration `20260921020747_pos_cart_scale_500.sql` changes only those bounds in seven current canonical functions, preserving locks, permission checks, payment snapshots, ACLs and search paths. Applied migrations were not edited.

Both ledger variants recreate all migrations and pass 126 groups. [Text](pos-phase7b-large-cart-text.json) and [enum](pos-phase7b-large-cart-enum.json) evidence covers 25/100/250/500 unique items, independent integer discounts/tax, canonical mock attempts/snapshots, concurrent finalization, stock/event cardinality and complete receipts. At 500 lines: subtotal 54,465 cents; discount 2,288; tax 4,478; total 56,655. A trigger fails the 251st stock mutation; the entire finalization rolls back, then retry yields one sale and exactly one event/deduction per item. A 501-line request is rejected.

[Browser scale](pos-phase7b-large-cart-browser.json) constructs all four sizes through keyboard-wedge event emulation and the real Register/SQL flow. The 500-line cart builds in about 32 seconds and checks out in about 2.2 seconds locally. Existing compact rows have no image overhead; measurements did not justify virtualization. These timings are observations, not production SLAs. [Hosted scale](pos-phase7b-performance-large.json) records real staging quote/checkout/receipt timings; local canonical mock tests cover payment state transitions, not real Square latency.

[Large receipt rendering](pos-phase7b-large-receipts.json) covers Chrome, Edge and WebKit at 80 mm and Letter. [PDF content checks](pos-phase7b-large-receipt-content.json) verify the final item and no blank pages. Letter output is 30 pages for the detailed 500-line fixture; roll output is one approximately 6.8-metre page. Browser output is complete and bounded, but physical feed/cutter/driver limits remain external acceptance. Prefer Letter for very large receipts.

## Performance and authorization

[Search guard](pos-phase7b-search-guard.json) takes 20 real authenticated round trips per name/set/location query against more than 10,000 items, including the first call, with a generous p95 ceiling of 2 seconds. The query review in [Phase 7](pos-phase7-search-query-review.json) identifies repeated per-row inventory authority evaluation as the original bottleneck. Authorized mapped locations are now materialized once per statement. No staging-only index or manual planner setting is required. Broad name queries can still scan candidates; the guard catches a return to repeated expensive authorization, not every sequential scan. Required schema/indexes are migration-owned.

[Staff matrix](pos-phase7b-staff-matrix.json) verifies owner, delegated employee, nondelegated employee, manager without delegation, cross-tenant actor, selling denial, separate refund authority and report denial. An explicit linked employee `pos.sell=false` cannot regain access through the ordinary member default, refund, payment, Terminal or Square RPCs. Root/mobile platform-access tests cover the shared navigation capability while database delegation remains authoritative. [Actual Next HTTP boundary checks](pos-phase7b-hosted-http-scale.json) additionally deny barcode lookup, quote and checkout to nondelegated staff, a manager with delegation revoked and another tenant. Hosted browser tests cover actual staff access, live revocation, attribution and independent manager approval.

## Provider budget and recovery

Budget consumption now occurs immediately before outbound Square provider work. Local history/capability reads and finalization of already confirmed payments do not spend the outbound budget. Webhook verification/reconciliation is separate from cashier polling. Refund/status/cancel provider calls remain budgeted. Unit tests bound a 30-request polling burst and verify known-paid finalization after exhaustion. Existing real-SQL concurrency tests enforce one finalization.

The client displays “Payment status checks are temporarily limited. Trading Docks will retry shortly.”, honors Retry-After (1–60 seconds), and retries the exact persisted request/key once. Continued throttling leaves a safe manual status-recovery message, never a replacement-payment recommendation. Two real browser tabs recover the same response-lost payment through injected 429 responses with two requests per tab and one sale. This combines browser retry evidence with provider-budget and SQL-concurrency evidence; it does not claim real Square traffic.

Payment, refund and Terminal emulation regressions cover provider success/local failure, response loss, reload, reconcile, duplicate events, cancellation and idempotent finalization. External webhook delivery and Terminal network interruption remain PENDING.

## Long shift and exact reconciliation

[Mixed browser shift](pos-phase7b-mixed-browser-shift.json): 100 sequential sales in one register (50 cash, 50 mock card), discounts, ten distinct positions, two batches, two locations and one restocking refund. All values below are cents.

| Measure | Expected and actual |
|---|---:|
| Gross | 10,000 |
| Discount | 1,250 |
| Tax | 775 |
| Refunds | 54 |
| Net | 9,471 |
| Cash net | 4,021 |
| Card | 5,450 |
| Drawer including 20,000 opening | 24,021 |
| Stock | 200 − 100 + 1 = 101 |

Exact parent/position/batch/location quantities agree. After warm-up, heap grows from 4.85 MB at sale 25 to 5.30 MB at 100; listeners stay 166–169, live DOM elements 72–73, and latency shows no material degradation. This is a bounded simulated shift, not proof against every possible long-running leak. Existing scanner listeners remain stable.

## Migration and fixture drift

[Manifest](pos-phase7-migration-manifest.json) records eleven immutable POS migration hashes and hosted timestamp mappings, alongside eight prerequisite files. The new scale migration is hosted as `20260921021607`. Both disposable ledger variants rebuild the complete ordered POS path; the same forward change applied successfully to isolated staging. No destructive recreation of hosted financial data was performed.

All essential state is represented by migrations, test fixtures or documented external configuration. Hosted scripts explicitly target `ukrcbmujzdyclrkghbvo`; normal dotenv files are not used to select hosted targets. The fixture records actual member-role staff and business/store membership alias. Synthetic financial history remains retained. Temporary staff permission changes restore their fixture baseline. No production schema equivalence or production restore rehearsal is claimed; those belong to the separate approval preflight in the [production plan](POS_PRODUCTION_MIGRATION_PLAN.md).

## Final validation

The authenticated fixture audit is recorded separately in [hosted browser fixture closure](pos-phase7b-hosted-browser-fixture-closure.json). It discovered ambiguous selectors for duplicate menu controls, transient loading landmarks, collapsed navigation groups and hidden/offscreen panels. The relevant dashboard components are unchanged from baseline `09bf765`. Tests now target the actual menu, expand navigation groups, wait for loading/closing transitions, and exclude ancestor-hidden panels while retaining visible overflow checks. The new POS “Staff & settings” link also matched the old broad Settings selector; the test now uses the intended `/dashboard/settings` href. This is a harmless test-label collision from the accepted navigation addition, not a broken destination. Synthetic users explicitly seed completed onboarding; mobile contexts explicitly receive their project's device options. These are fixture corrections, not product behavior changes.

| Check | Result |
|---|---|
| Root TypeScript / unit tests | PASS / 947 passed, zero skipped |
| Root ESLint | PASS, zero errors; 534 existing warnings |
| Mobile TypeScript / unit tests | PASS / 580 passed, zero skipped |
| Mobile ESLint | PASS, zero errors; three existing warnings |
| Text and enum migration/DB regression | PASS, 126 groups each |
| POS browser, payment/refund recovery, Terminal emulator, labels/Chaos integration | PASS; latest browser harness plus 122 base DB groups |
| Hosted Auth/concurrency/register lifecycle | PASS, 18 assertions |
| Hosted direct RLS/anonymous/cross-tenant security | PASS, 15 assertions |
| Hosted focused employee permission matrix | PASS, 29 assertions |
| Hosted POS Chrome / Edge / WebKit | PASS, eight assertions each |
| Hosted delegated employee/manager browser | PASS, 13 assertions |
| Hosted 500-line HTTP scale and three-role API denial | PASS, six groups |
| Public browser regression | 229 passes; sole subsequent rounding failure resolved by 16/16 targeted retests; eight auth placeholders covered separately |
| Hosted authenticated dashboard | PASS, [41 tests](pos-phase7b-hosted-dashboard.json), zero skips |
| Receipt PDFs, Chrome and Edge | PASS, 18 cases each |
| Label PDFs, Chrome and Edge | PASS, ten cases each, plus six preset screenshots per run |
| Large receipts, Chrome / Edge / WebKit | PASS, six rendering cases; four PDFs verified complete without blank pages |
| 100-transaction mixed browser shift | PASS, exact accounting and provenance reconciliation |
| Next production build | PASS, public fixture build and explicit staging build |
| Expo exports | PASS, web / iOS / Android bundles; no native hardware certification |
| Known-secret leakage scan | PASS; see current [audit](pos-phase7b-secret-audit.json), no findings |
| Whitespace validation | PASS, `git diff --check` |

Reproduction: run `npm run typecheck`, `npm test`, `npm run lint`; in `mobile/`, run `npx tsc --noEmit`, `npm test`, `npm run lint`, and Expo export for all platforms. POS commands are `npm run test:pos:db`, `node tests/pos-db.mjs --browser --large-cart`, `npm run test:pos:shift`, `npm run test:pos:hosted`, `npm run test:pos:print`, and `npm run test:labels:print`. Receipt/label scripts accept `--edge`. The large-receipt script consumes the ignored receipt generated by the DB scale test.

Run the public Playwright suite before `node tests/pos-staging-app.mjs`; they share the build directory and loopback port. With that explicit staging server, run `npx playwright test --config playwright.pos-staging.config.ts`, `node tests/pos-hosted-browser.mjs` (also `--edge`, `--webkit`, `--delegated` sequentially) and `node tests/pos-hosted-api-scale.mjs`. Hosted scripts require the ignored synthetic fixture and staging credential files; do not replace them with production dotenv values. Raw logs/browser JSON/screenshots remain ignored under `.local-fixtures/`; sanitized results are review artifacts under `docs/` (working tree, not yet committed).

## External gates and readiness

See [external checklist](POS_EXTERNAL_ACCEPTANCE_CHECKLIST.md) for exact Square setup, callback/webhook paths, scopes, secret variable names and the Sandbox/physical Terminal distinction; use the [hardware sheet](POS_HARDWARE_ACCEPTANCE_SHEET.md) for device evidence. Square credentials, physical scanner/printers/Terminal and production approval remain unavailable. They are PENDING, not failed. No production Supabase changes, production deployment, production Square credentials, real money, main merge or live tenant enablement occurred.


## Final blocker matrix

| Category | Unresolved critical blockers | Status |
|---|---:|---|
| ENGINEERING, Phase 7B scope | 0 | All identified failures resolved with passing evidence; no unexplained red result |
| EXTERNAL ACCOUNT | Real Square app/merchant, OAuth, signed delivery and Sandbox Terminal API acceptance | PENDING |
| PHYSICAL HARDWARE | Scanner, label/receipt/Letter printers, scan-back, Terminal and interruption drills | PENDING |
| PRODUCTION APPROVAL | Migration/deployment, production provider review, backup/restore rehearsal and live tenant enablement | NOT AUTHORIZED |

Final classification: **ENGINEERING READY / EXTERNAL ACCEPTANCE PENDING**. **Pilot readiness: NOT READY** until the relevant external gates and explicit approval are complete. Physical Square hardware cannot close a Sandbox gate; the external checklist distinguishes the environments. Changes remain reviewable in the working tree on `codex/pos-foundation`; nothing was merged, deployed or connected to production.
