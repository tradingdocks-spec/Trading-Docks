# Trading Docks Production Launch Certification

## Decision

NO-GO

## Certification Date

August 22, 2026

## Scope And Launch Freeze

This certification is the final Production Launch Program checkpoint on `codex/production-launch-hardening`.

Launch freeze is active:

- No new product features.
- No plan, pricing, billing, or entitlement redesign.
- No broad UI redesign.
- No new marketplace/provider integrations.
- No destructive production database changes.
- Only P0/P1 launch blockers, production configuration defects, validation failures, and material trust/security/performance issues should be fixed before launch.

## Build / Test Evidence

Latest automated baseline before this document:

| Gate | Result | Evidence |
| --- | --- | --- |
| Production build | PASS | `npm run build` passed and emitted the active Next.js route manifest. |
| Web TypeScript | PASS | `npm run typecheck` passed. |
| Mobile TypeScript | PASS | `npx tsc --noEmit -p mobile/tsconfig.json` passed. |
| ESLint | PASS | `npm run lint -- --quiet` passed. |
| Unit tests | PASS | `npm test`: 505 passing. |
| Mobile tests | PASS | `npm --prefix mobile test`: 569 passing. |
| Browser E2E | PASS WITH SKIPS | `npm run test:e2e`: 86 passing, 42 skipped. Skips include authenticated account tests because credentials were absent. |
| Whitespace diff check | PASS | `git diff --check` passed. |
| Generated Next artifacts | PASS | `git ls-files .next` returned no tracked files. |

Authenticated Playwright credentials present in this shell:

| Credential group | Status |
| --- | --- |
| `PLAYWRIGHT_AUTH_EMAIL` / `PLAYWRIGHT_AUTH_PASSWORD` | ABSENT |
| Free account credentials | ABSENT |
| Collector account credentials | ABSENT |
| Seller account credentials | ABSENT |
| Store account credentials | ABSENT |
| Owner/Admin account credentials | ABSENT |

Authenticated browser certification therefore remains MANUAL REQUIRED.

## Launch Gate Matrix

### Application

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Production build | PASS | Local production build passed. |
| TypeScript | PASS | Web and mobile typechecks passed. |
| Lint | PASS | ESLint passed. |
| Unit tests | PASS | Root tests passed. |
| Browser E2E | PASS WITH MANUAL REQUIRED | Public matrix passed; authenticated tests skipped due absent credentials. |
| Mobile tests | PASS | Mobile node test suite passed. |

### Security

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Authentication | MANUAL REQUIRED | Auth UI/source tests pass, but production sign-in, reset, email, OAuth, and session restore were not executed with real accounts in this phase. |
| Authorization | PASS WITH MANUAL REQUIRED | API/route capability registries and unit coverage exist; real direct-route attempts with deployed accounts remain required. |
| Workspace isolation | FAIL | User A / User B isolation was not executed against a safe deployed Supabase environment. This is a P0 launch gate. |
| Entitlement enforcement | PASS WITH MANUAL REQUIRED | Automated entitlement tests cover Free/Collector/Seller/Store/Owner logic; real account browser verification remains required. |
| Owner/admin separation | PASS WITH MANUAL REQUIRED | Trusted platform role model is tested; deployed Owner/Admin browser walkthrough remains required. |
| API classification | PASS | Concrete API and route registries are in place; scanner and binder-share direct mutation gates are hardened. |

### Billing

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Checkout | FAIL | RevenueCat web purchase env variables were not present in production Vercel env metadata. No sandbox/live checkout was executed. |
| RevenueCat entitlement sync | MANUAL REQUIRED | Resolver and webhook tests pass; provider lifecycle was not tested end to end. |
| Webhook verification | MANUAL REQUIRED | Route exists and tests cover auth/idempotency/stale ordering; live RevenueCat event certification is not recorded here. |
| Cancellation | MANUAL REQUIRED | Covered by resolver tests only, not provider lifecycle. |
| Renewal | MANUAL REQUIRED | Not executed. |
| Failed payment behavior | MANUAL REQUIRED | Not executed. |
| Web/mobile shared entitlement | MANUAL REQUIRED | Same Supabase UUID contract exists; actual web/mobile purchase sharing was not executed. |

### Product

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Public site | PASS WITH DEPLOY REQUIRED | Public local/browser automation passes; live production `sitemap.xml` is currently 404 until the sitemap fix in this branch is deployed. |
| Dashboard shell | MANUAL REQUIRED | Authenticated browser shell tests skipped due absent credentials. |
| Inventory | MANUAL REQUIRED | Automated source/tests exist; populated account browser QA not executed. |
| Orders | MANUAL REQUIRED | Automated source/build coverage exists; populated order/provider QA not executed. |
| Analytics | MANUAL REQUIRED | Populated charts/metrics not exercised. |
| CRM | MANUAL REQUIRED | Source/tests exist; populated create/edit browser QA not executed. |
| Deck Architect | P0 FAIL / MANUAL REQUIRED | Engine-level repair tests pass, but authenticated rendered-product QA for Pauper and Krenko was not executable in this shell because no Playwright QA credentials are configured. Do not promote to PASS until the browser checklist below is completed. |
| Deck Vault | MANUAL REQUIRED | Automated tests exist; populated visual/text/share/export QA not executed. |
| Imports | MANUAL REQUIRED | Importer tests pass; real storage/provider/admin import flow not executed here. |
| Settings | MANUAL REQUIRED | Source/tests cover dead-action cleanup; real browser account settings flow not executed. |
| Billing | FAIL | RevenueCat web purchase/portal env is missing or unverified in production metadata. |

### Device

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Desktop Chrome | PASS WITH MANUAL REQUIRED | Public Playwright Chromium passes; authenticated product workflows not run. |
| Desktop Firefox | PASS WITH MANUAL REQUIRED | Public Playwright Firefox passes; authenticated product workflows not run. |
| Desktop WebKit/Safari equivalent | PASS WITH MANUAL REQUIRED | Public Playwright WebKit route-smoke passes; real Safari/authenticated workflow remains required. |
| iPhone Safari | FAIL | Physical-device certification was not executed. |
| Android Chrome | FAIL | Physical-device certification was not executed. |
| Native mobile app | FAIL IF MOBILE IS IN LAUNCH SCOPE | Mobile tests pass, but physical iOS/Android build validation was not executed. |

### Performance

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Public route responsiveness | PASS FOR CONTROLLED BETA | Local production route baseline is documented in `docs/PERFORMANCE_PRODUCTION_READINESS.md`. |
| Authenticated route responsiveness | MANUAL REQUIRED | No real-account dashboard timing was executed. |
| Large-workspace behavior | MANUAL REQUIRED | Query-plan and populated-account performance certification not executed. |
| Image delivery | PASS WITH WATCH | Oversized public/auth logo variants fixed; card-image-heavy routes need populated QA. |
| Major query risks | WATCH | Collection pagination exists; dashboard analytics/orders/CRM large-account query plans remain P1 follow-up before broad launch. |

### Production

| Gate | Status | Evidence / blocker |
| --- | --- | --- |
| Environment variables | FAIL | Core Supabase and webhook vars are present in Vercel metadata; RevenueCat web purchase/portal vars are missing, and obsolete TCGTracking shipping vars remain present. |
| Domain | PASS | `https://www.tradingdocks.com/` returns 200. |
| HTTPS | PASS | Production HTTPS requests succeeded. |
| Redirects | PASS | `https://tradingdocks.com/` returns 308 to `https://www.tradingdocks.com/`; `/dashboard` redirects to sign-in. |
| Sitemap | FAIL UNTIL DEPLOYED | Production `/sitemap.xml` returns 404. This branch adds `src/app/sitemap.ts`. |
| Robots | PASS | Production `robots.txt` allows public routes and disallows dashboard/onboarding/API/share paths. |
| Metadata | PASS | Production homepage has title, description, canonical URL, and OpenGraph metadata. |
| Error monitoring | MANUAL REQUIRED | No production error-monitoring provider was confirmed. |
| Analytics/Web Vitals | MANUAL REQUIRED | No Web Vitals/analytics instrumentation was confirmed. |
| Support/contact | MANUAL REQUIRED | Support-assisted deletion path exists in source, but production completion path was not tested. |
| Privacy | PASS WITH MANUAL REVIEW | `/privacy` returns 200; legal content was not reviewed for legal sufficiency. |
| Terms | PASS WITH MANUAL REVIEW | `/terms` returns 200; legal content was not reviewed for legal sufficiency. |

## Production Environment

Vercel production env metadata was inspected with `vercel env list production --json`. Secret values were not printed or inspected.

| Variable | Production status |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | PRESENT |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | PRESENT |
| `SUPABASE_SERVICE_ROLE_KEY` | PRESENT |
| `NEXT_PUBLIC_APP_URL` | PRESENT |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | PRESENT |
| `RESEND_API_KEY` | PRESENT |
| `RESEND_FROM_EMAIL` | PRESENT |
| `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY` | PRESENT |
| `JUSTTCG_API_KEY` | PRESENT |
| `CLOUDFLARE_EMAIL_WEBHOOK_SECRET` | PRESENT |
| `OPENAI_API_KEY` | PRESENT |
| `OPENAI_VISION_MODEL` | PRESENT |
| `REVENUECAT_WEB_PURCHASE_LINK` | MISSING |
| `REVENUECAT_WEB_COLLECTOR_MONTHLY_URL` | MISSING |
| `REVENUECAT_WEB_COLLECTOR_YEARLY_URL` | MISSING |
| `REVENUECAT_WEB_SELLER_MONTHLY_URL` | MISSING |
| `REVENUECAT_WEB_SELLER_YEARLY_URL` | MISSING |
| `REVENUECAT_WEB_STORE_MONTHLY_URL` | MISSING |
| `REVENUECAT_WEB_STORE_YEARLY_URL` | MISSING |
| `REVENUECAT_WEB_CUSTOMER_PORTAL_URL` | MISSING |
| `REVENUECAT_WEB_MANAGEMENT_URL` | MISSING |
| `TCGTRACKING_API_KEY` | MISSING |
| `TCGTRACKING_API_BASE_URL` | MISSING, optional default exists |
| `TCGTRACKING_SCAN_BASE_URL` | MISSING, optional default exists |
| `TCGTRACKING_SHIPPING_API_KEY` | PRESENT, obsolete shipping-specific key |
| `TCGTRACKING_SHIPPER_NUMBER` | PRESENT, obsolete shipping-specific key |

Production env conclusion:

- Core Supabase server/browser configuration is present.
- RevenueCat webhook authorization is present.
- RevenueCat web purchase and portal/management configuration is missing, so paid web checkout cannot be certified.
- Shipping-specific TCGTracking variables remain configured even though shipping integration was intentionally retired. Remove manually from Vercel after confirming no active code path reads them.

## Domain / SEO

Production checks executed with read-only HTTP requests:

| URL | Result |
| --- | --- |
| `https://www.tradingdocks.com/` | 200 |
| `https://tradingdocks.com/` | 308 to `https://www.tradingdocks.com/` |
| `https://www.tradingdocks.com/pricing` | 200 |
| `https://www.tradingdocks.com/sign-in` | 200 |
| `https://www.tradingdocks.com/robots.txt` | 200 |
| `https://www.tradingdocks.com/sitemap.xml` | 404 in current production |
| `https://www.tradingdocks.com/dashboard` | 307 to `/sign-in?next=%2Fdashboard` |
| malformed certification route | 404 |

Fix in this branch:

- Added canonical `src/app/sitemap.ts`.
- Added sitemap reference to `src/app/robots.ts`.
- Added source regression coverage so dashboard/API routes are not included in the sitemap.

This fix requires deployment before production SEO can be marked PASS.

## Security Certification

Automated/source evidence:

- Shared platform access and billing access resolution are tested.
- Owner/Admin effective access is separated from billing tier.
- API and route access registries classify active routes.
- Direct scanner-provider and binder-share APIs enforce capabilities.
- Public route middleware no longer crashes when Supabase public config is absent.

Not certified:

- Real User A / User B isolation across deployed inventory, orders, customers, decks, imports, settings, workspace records, and direct object-ID attempts.
- Production Owner/Admin browser route walkthrough.
- Expired/invalid session behavior with real deployed sessions.

Security decision: NO-GO for broad public launch until User A / User B isolation is executed and recorded.

## Billing Certification

Automated/source evidence:

- RevenueCat webhook authentication/idempotency/stale-ordering tests exist.
- Billing access resolver handles provider rows, manual overrides, legacy fallback, cancellations, grace periods, and Owner/Admin platform authority.
- Web and mobile are designed to share Supabase Auth UUID as RevenueCat identity.

Not certified:

- New paid subscription.
- Upgrade/downgrade.
- Cancel at period end.
- Renewal.
- Failed payment.
- Webhook retry/duplicate/stale event in a real provider environment.
- Same account on web/mobile after entitlement change.
- Production web checkout, because web purchase/portal env variables are missing.

Billing decision: NO-GO.

## Browser Certification

Certified:

- Public unauthenticated Playwright matrix: Chromium, Firefox, WebKit, tablet, and mobile emulation passed.
- Public route status/error/overflow checks passed.

Not certified:

- Authenticated dashboard/product workflows because QA credentials were absent.
- Populated account workflows.
- Real Safari browser behavior beyond Playwright WebKit.

Browser decision: GO for public unauthenticated shell; NO-GO for authenticated product certification.

## Mobile Certification

Certified:

- Mobile TypeScript and mobile tests passed.

Not certified:

- Physical iPhone Safari.
- Physical Android Chrome.
- Native app login/logout/session restore.
- Native scanner/offline/billing/device flows.

Mobile decision: NO-GO for broad launch.

## Product Workflow Certification

Automated/source evidence:

- Route/build coverage includes active dashboard, inventory, orders, analytics, CRM, Deck Architect, Deck Vault, imports, Settings, Billing, Admin, Label Studio, public QR/share routes, and webhook/API routes.
- Extensive unit tests cover many business contracts.
- Deck Architect source now routes non-Commander builds through `constructValidatedFormatDeck`; the workspace only renders/saves generated decks when the build status is `complete`.
- Deck Architect focused tests cover complete Pauper generation, illegal Pauper staple exclusion, exact owned/missing quantities, complete Krenko Commander generation, and UI routing away from the legacy owned-card pile helper.

Not certified:

- Populated Inventory with hundreds/thousands of records.
- Populated Orders with multiple statuses/channels.
- Populated CRM create/edit flow.
- Populated Analytics metrics/charts.
- Full generated Deck Architect result in authenticated browser.
- Deck Vault visual/text/share/export in browser/mobile.
- Real imports against storage/provider environments.

Product workflow decision: NO-GO for broad launch.

## Deck Architect Rendered-Product Certification

Status: P0 FAIL / MANUAL REQUIRED.

What is automated and passing:

- `tests/deck-architect.test.ts` validates the repaired engine contracts.
- Pauper full-intelligence construction returns a complete 60-card validated result contract.
- Known-illegal Pauper cards such as `Rhystic Study` and `Wheel of Fortune` are excluded from Pauper outputs.
- Owned/missing quantities are calculated from exact required quantities; partial ownership is not treated as complete ownership.
- Krenko, Mob Boss / Goblin Swarm remains the complete Commander benchmark with a validated 100-card result.
- The workspace source requires `activeBuildStatus === "complete"` before showing a working deck or allowing Deck Vault handoff.

What could not be certified here:

- No `PLAYWRIGHT_AUTH_EMAIL` / `PLAYWRIGHT_AUTH_PASSWORD` or tier-specific Playwright credentials were present.
- Therefore, the authenticated rendered Deck Architect page was not opened with real QA inventory data.
- Deck Architect must not move from P0 FAIL to PASS until the following browser scenarios are executed and recorded.

Required browser scenario A: Pauper / Collection Optimized / Competitive

1. Sign in with a QA account that has representative collection data including legal Pauper cards and at least one non-Pauper Commander staple such as `Wheel of Fortune`.
2. Open `/dashboard/deck-architect`.
3. Choose `Build From My Collection`.
4. Select format `Pauper`.
5. Set card source to Collection + suggestions / Collection Optimized.
6. Set power target to `Competitive`.
7. Click `Build My Deck`.
8. Verify the rendered result shows exactly 60 main-deck cards.
9. Verify no illegal Pauper cards are present, including `Wheel of Fortune`, `Rhystic Study`, or Commander-only staples.
10. Verify the selected archetype is coherent and named, not a random two-card shell.
11. Verify lands are present.
12. Verify Buildability is calculated and not `Not calculated`.
13. Verify Deck Health is calculated and not `Not calculated`.
14. Verify owned and missing quantities are shown for cards with partial ownership.
15. Verify missing cards are shown correctly and no incomplete plan says the user owns every card.
16. Verify `Open in Deck Builder` works only for the complete validated result.
17. Verify saving/opening in Deck Vault is blocked for any failed/draft state and works for the complete validated result.

Required browser scenario B: Commander / Krenko, Mob Boss

1. Sign in with a QA account that can access Deck Architect.
2. Open `/dashboard/deck-architect`.
3. Choose `Build a Deck`.
4. Select format `Commander`.
5. Search/select `Krenko, Mob Boss`.
6. Select the Goblin strategy or allow Deck Architect to choose it.
7. Use Best Possible / Competitive-equivalent strength.
8. Click `Build My Deck`.
9. Verify the rendered result shows exactly 100 cards including the commander.
10. Verify every nonland card is mono-red or colorless and within Krenko's color identity.
11. Verify Goblin strategy density is visible through Goblin token makers/payoffs, haste/untap support, sacrifice outlets, and token payoffs.
12. Verify lands are present.
13. Verify ramp, card advantage, interaction/removal, protection/support, strategy engines, payoffs, win conditions, utility, and lands are populated.
14. Verify Buildability is calculated.
15. Verify Deck Health is calculated.
16. Verify missing cards are shown correctly.
17. Click `Open in Deck Builder`.
18. Verify Deck Builder preserves card quantities and the commander slot.

Previous broken states that must remain absent:

- No 2-card Pauper shell.
- No successful-build `Not calculated` metrics.
- No `Wheel of Fortune` or other known-illegal card in Pauper.
- No fake "you own every card" message caused by an incomplete plan.

## Performance Certification

Certified:

- Public runtime hardening and local production baseline are documented in `docs/PERFORMANCE_PRODUCTION_READINESS.md`.
- Public route logo/image sizing issue fixed.
- Public market-feed caching issue fixed.

Not certified:

- Authenticated dashboard timing.
- Large workspace query plans.
- Populated data image/layout behavior.
- Real production Web Vitals.

Performance decision: GO for controlled beta public shell; NO-GO for broad launch without authenticated and large-workspace evidence.

## Monitoring

Observed:

- Vercel, Supabase, and provider dashboards likely provide some deployment/service logs, but no repository-confirmed Web Vitals or frontend runtime error monitoring integration was found.

Not certified:

- Frontend runtime error visibility.
- Server/API failure alerting.
- Failed import alerting.
- Auth failure monitoring.
- Web Vitals/performance monitoring.

Monitoring decision: MANUAL REQUIRED and P1 before broad launch.

## Privacy / Support

Observed:

- `/privacy` and `/terms` return 200 in production.
- Settings Data & Privacy now labels export/deletion as support-assisted where automation is not fully implemented.

Not certified:

- Actual support request receipt and response path.
- Legal sufficiency of Privacy/Terms content.
- Complete account deletion workflow fulfillment.

Privacy/support decision: MANUAL REQUIRED. Support-assisted deletion may be acceptable for controlled beta if the support path is confirmed.

## Recovery

Verified:

- Deployment rollback capability exists through Vercel conceptually, but no rollback drill was executed.
- TCGplayer catalog import is resumable and does not require a single long-running HTTP request.

Unverified:

- Supabase backup schedule/retention for the production project.
- Point-in-time restore availability.
- User inventory recovery workflow.
- Tested deployment rollback.
- Tested migration rollback/remediation playbooks.

Recovery decision: MANUAL REQUIRED.

## Remaining Defects

### P0

1. User A / User B production-grade isolation certification has not been executed.
   - Required action: run deployed safe-environment tests for UI and direct API/object-ID attempts across inventory, orders, customers, decks, analytics-derived resources, imports, settings, workspace records, and Label Studio.

2. RevenueCat billing lifecycle is not production-certified and web checkout env variables are missing.
   - Required action: configure RevenueCat web purchase and portal/management env variables, redeploy, then test Free -> paid -> entitlement sync -> cancellation/renewal/failure/retry across web and mobile where applicable.

### P1

1. Physical device certification has not been executed.
   - Required action: run iPhone Safari and Android Chrome workflow matrix; run native app device validation if mobile is included in launch scope.

2. Authenticated product browser certification has not been executed.
   - Required action: provide Playwright QA credentials or manually test Free, Collector, Seller, Store, and Owner/Admin routes and record results.

3. Populated product QA has not been executed.
   - Required action: test Inventory, Orders, CRM, Analytics, Deck Architect, and Deck Vault with real populated representative accounts.

4. Production monitoring/Web Vitals/error visibility is not certified.
   - Required action: confirm Vercel/Supabase/provider alerting coverage or add one production-grade frontend/server monitoring path.

5. Large-workspace performance is not certified.
   - Required action: run authenticated route timing and Supabase query-plan/index checks for high-volume Inventory, Orders, CRM, and Analytics.

6. Production sitemap currently returns 404 until this branch is deployed.
   - Required action: deploy the sitemap fix and verify `https://www.tradingdocks.com/sitemap.xml` returns 200.

7. Production env contains obsolete TCGTracking shipping-specific variables.
   - Required action: manually remove `TCGTRACKING_SHIPPING_API_KEY` and `TCGTRACKING_SHIPPER_NUMBER` after confirming no active shipping code path remains deployed.

8. Recovery posture is not certified.
   - Required action: verify Supabase backups/PITR, deployment rollback, and data recovery procedure.

9. Support/contact path for account deletion/export requests is not certified.
   - Required action: verify the support-assisted path actually reaches a monitored inbox/workflow.

### P2

1. Public legal content was reachable but not legally reviewed.
2. Dashboard route-level bundle attribution remains a performance follow-up.
3. Authenticated premium polish screenshots remain incomplete.
4. Optional TCGTracking Open API auth env is missing; provider defaults may work, but authenticated/rate-limit behavior is not certified.

### P3

1. Node test runner emits module-type reparsing warnings; not launch-blocking.
2. Vercel CLI reports an available update; not launch-blocking.

## Minimum Requirements To GO

1. Run and pass User A / User B isolation certification in a safe deployed Supabase environment.
2. Configure missing RevenueCat web purchase and portal/management env variables.
3. Run and pass RevenueCat lifecycle certification, including webhook retry/duplicate/stale cases and web/mobile shared entitlement where mobile is in scope.
4. Provide authenticated QA credentials and run/pass authenticated Playwright or equivalent browser walkthroughs for Free, Collector, Seller, Store, and Owner/Admin.
5. Run/pass physical iPhone Safari and Android Chrome validation; run/pass native mobile device validation if mobile is in launch scope.
6. Run/pass populated product QA for Inventory, Orders, CRM, Analytics, Deck Architect, and Deck Vault.
7. Verify production monitoring/error/Web Vitals visibility.
8. Verify Supabase backup/recovery and deployment rollback posture.
9. Deploy this branch's sitemap fix and confirm production `/sitemap.xml` returns 200.
10. Confirm support/contact path for privacy/deletion/export requests.

## Final Recommendation

NO-GO

Trading Docks has strong automated validation and has closed several launch-hardening issues, but it is not yet safe to accept public users and money broadly because the critical real-environment gates remain incomplete: account isolation, billing lifecycle, physical device QA, authenticated populated product QA, production monitoring, recovery posture, and production payment configuration.
