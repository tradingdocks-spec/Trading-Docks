# Production launch certification refresh — September 6, 2026

**Decision: NO-GO for paid public launch. Status: Partially Implemented.**

LC-01 and LC-02 now have a [locally verified remediation candidate](P0_INVENTORY_TRANSACTION_REMEDIATION_2026-09-06.md). Both production blockers remain OPEN pending the approved migration and staging/deployed verification. The audit evidence below describes the original findings; all other gates are unchanged.

Two inventory-integrity defects were reproduced with local database doubles. Paid signup intent is not carried through to checkout, and deployed account isolation, authentication lifecycle, billing lifecycle, and recovery remain uncertified. Passing source tests and public browser smoke tests do not close those gates.

This is an audit and prioritized remediation report, not an implementation or deployment release. It refreshes the [August 22 certification](PRODUCTION_LAUNCH_CERTIFICATION.md); its historical production environment observations must not be treated as current configuration evidence.

## Scope and evidence boundary

- Repository base: `163d613ef4b6543eb1b3651e7fa6fc06d131dcd1`; audit branch: `codex/launch-certification-refresh`.
- Checks ran against the current working tree, including substantial pre-existing mobile and package changes. This is not certification of a clean commit or of the exact production deployment.
- Inspected active Next.js source, selected API/server boundaries, migrations, billing authority, public copy, inventory persistence, authentication proxy, and the existing Playwright suite. Historical mobile backup directories are outside scope.
- Live checks were read-only public HTTP requests. No customer records, test accounts, provider subscriptions, schema, environment settings, secrets, or deployments were changed.
- No exhaustive per-route penetration test or database introspection was performed. Findings distinguish reproduced behavior, source findings, and unverified release gates.
- No physical iOS/Android or Expo export/native build was executed. Existing test credentials were absent from this shell; none were requested or printed in the report.
- Build tooling regenerated `next-env.d.ts`, which was already modified at audit start. Its prior uncommitted content was not captured. The audit did not intentionally edit runtime code; generated TypeScript build-info changes were restored where their initial state was known clean.

## Fresh automated results

Raw logs and the two executable reproductions are in the local [audit evidence directory](../.launch-audit/). These artifacts are currently uncommitted, alongside this report.

| Check | Fresh result | Meaning and limit |
| --- | --- | --- |
| `npm run check` | **FAIL** | Stops at root ESLint: 21 errors, 471 warnings. Subsequent stages were run separately. |
| `npm run typecheck` | PASS | Web TypeScript, exit 0. |
| `npm test` | PASS | 549 passed; zero failed/skipped. Includes source-contract tests; not database certification. |
| `npm audit --omit=dev --audit-level=high` | PASS | Root dependency audit returned zero vulnerabilities at execution time; not a full supply-chain/security audit or separate mobile dependency audit. |
| `npm run test:e2e -- --workers=2` | PASS WITH SKIPS | 86 passed, 42 skipped in 1.7 minutes. Local production build/start completed through Playwright's configured web server. |
| `npx tsc --noEmit -p mobile/tsconfig.json` | PASS | Mobile TypeScript, exit 0. |
| `npm --prefix mobile test` | PASS | 620 passed; zero failed/skipped. |
| `npm --prefix mobile run lint` | PASS WITH WARNINGS | Zero errors, eight warnings under the mobile configuration. Root and mobile lint rules differ. |
| `npm --prefix mobile run verify:production-release` | LIMITED PASS | Script returned `ok: true` but explicitly skipped strict production environment checks because `NODE_ENV` was not production. |
| Fulfillment failure injection | **DEFECT REPRODUCED** | Real route returned 200/shipped after an injected inventory write error. |
| CSV location persistence reproduction | **DEFECT REPRODUCED** | Real diff helper omitted the location write when passed the references constructed by the CSV caller. |
| Expo Web / Expo Native / real devices | NOT RUN | Required separately if mobile ships in this release. |

The root lint errors include ref access during render in `mobile/components/scanner/automatic-scanner-screen.tsx`, forbidden `require()` and literal assertion rules in `prebuilt-scanner-bakeoff-screen.native.tsx`, and the Next.js `module` variable rule in `mobile/services/mobile-deck-vault.ts`. Do not characterize root validation as passing because mobile lint passes. Reconcile the intended lint scope and fix applicable errors without weakening the checks to conceal failures.

## P0 — confirmed defects and mandatory release gates

### LC-01: Shipping can report success after the inventory deduction fails

**Confirmed by route-level failure injection. Owner: inventory/backend engineering.**

Evidence: [order fulfillment route](../src/app/api/orders/fulfillment/route.ts), especially lines 50–71. The deduction, line marker, and movement insertion are separately awaited without checking their returned errors. Only the final order update error is handled. Line-query errors are also ignored and can become an empty list.

Reproduction: run `node .launch-audit/reproduce-fulfillment.mjs` from the repository root. It transpiles and executes the real `PATCH` handler, replacing only its imports with a memory-backed authorization/database double. The `inventory_items` update returns an error; later writes succeed. Actual response: HTTP 200, `{ "stage": "shipped" }`; the line is marked deducted despite the failed write. This is not a real-database test.

Separate source risk: shipping several lines can commit earlier deductions before a later line returns 409. Concurrent requests read quantities and deduction markers before separate writes, without an atomic order-level claim. A retry marker alone does not establish concurrency safety.

Required fix: one authorized, transactional fulfillment operation covering stock checks, deductions, line markers, movements, and order stage; enforce idempotency and concurrency control. Schema changes require the explicit approval specified in AGENTS.md.

Close only after tests cover a failed first/middle/final write, insufficient stock on a later line, duplicate request, two concurrent shipments competing for stock, interrupted response followed by retry, and exact before/after inventory and movement totals. Failure must leave the transaction unchanged and never claim shipment success.

### LC-02: CSV imports omit new or changed locations from persistence

**Confirmed by persistence-helper reproduction and active caller source. Owner: inventory/import engineering.**

Evidence: [CSV conversion engine](../src/components/dashboard/tools/CsvConversionEngine.tsx), lines 442, 457, 487–501, and [inventory persistence](../src/lib/inventory-persistence.ts), lines 64–79. This engine is imported by the active `/dashboard/tools/csv-converter` route.

The caller aliases `currentSnapshot.locations`, pushes a new location into it, and changes its counters before passing `currentSnapshot` as the previous snapshot. The diff therefore sees identical previous/current locations and emits no location upsert.

Reproduction: `node .launch-audit/reproduce-csv-location.mjs`. The actual persistence helper, with the caller's reference arrangement and a database double, writes `inventory_items` but never `inventory_locations`. A deployed foreign key may reject the item; without an effective constraint, the reference can point to an unsaved location. The deployed outcome was not tested.

Further integrity concerns in the same path: saves use separate 500-row chunks across tables, with no all-import rollback; each invocation generates new UUIDs, so retrying after a partial save can create additional copies. The caller does await persistence before its success notice, which is good, but does not solve partial commit or replay identity.

Required fix: preserve an immutable before snapshot, persist location authority, and define durable import identity with safe retry/rollback behavior. Close with a new location, existing-location counters, failure after the first batch, retry after timeout, duplicate upload, and refresh verification against authoritative records.

### LC-03: Paid plan intent is hidden and onboarding does not resume checkout

**Confirmed in current source and public signup output. Owner: signup/billing engineering.**

[Sign-up](../src/app/sign-up/page.tsx) validates the plan query but uses it as hidden fields (line 678); the visible form retains generic account copy and the no-card message. [Auth actions](../src/app/actions/auth.ts) store requested plan/billing metadata, while [completeOnboarding](../src/app/actions/workspace.ts) completes preferences and redirects to `/dashboard` without using that intent to resume checkout.

The current billing integration is **RevenueCat**, via `/api/billing/revenuecat` and `/api/webhooks/revenuecat`. Historical Stripe migrations are not evidence of an active Stripe checkout path. Adapt the pasted lifecycle checklist to RevenueCat and its configured payment channel; do not add a second billing authority.

Required fix: visibly name the selected tier, actual price/cycle, and payment timing; preserve intent through email verification, sign-in, and onboarding; continue into configured RevenueCat checkout. Account/workspace preferences must never grant paid entitlements. Test all paid plans and cycles, verification in another tab, returning users, abandoned checkout, failed checkout, and eventual entitlement arrival.

### LC-04: Two-account isolation is not certified

**Unverified P0 gate, not a demonstrated cross-tenant breach. Owner: security/backend QA.**

Positive source evidence: collection mutations query both `user_id` and item ID; storage assignment checks the location owner; fulfillment looks up orders and lines under the authenticated user; marketplace credentials require a capability and are scoped to the user. Security migrations include ownership controls, row locking, and quantity-limit locking.

These controls do not prove deployed policies or every service-role path. The older [RLS audit](SUPABASE_RLS_AUDIT.md) explicitly is not production introspection, and parts predate later security migrations. Do not infer deployed migration status from filenames.

Close in an isolated staging environment with two ordinary accounts and separate workspaces. Test reads AND writes in both directions for inventory, orders/lines, customers, decks, credentials, locations, CSV/import jobs, scanner submissions, analytics, purchase sessions, account documents, labels, shares, and server actions. Repeat through UI URLs, direct API bodies/IDs, and direct Supabase requests using the user's token. Verify no returned fields or changed rows; separately verify allowed public-share behavior and explicit trusted admin scope. Record migration/policy state and revoke/suspended-member behavior.

### LC-05: Auth/session lifecycle remains uncertified

**Unverified P0 gate. Owner: auth engineering/QA.**

The proxy verifies users server-side and preserves cookie options when redirecting. Public `/dashboard` redirects correctly. The repository has a navigation/refresh/new-tab test, but it only runs once in desktop Chromium and was not run here because account credentials were absent.

Close with successful normal and direct-link login, collection/decks/Deal Desk/orders/settings navigation, refresh, new tab, persistent browser restart, expired session, invalid refresh token, reset, email verification, logout across tabs, and returning-user flows. Include actual Safari/mobile Safari; Playwright WebKit is useful coverage but not physical Safari certification. Record expected behavior separately for remembered and non-remembered sessions.

### LC-06: Billing lifecycle and event ordering require certification

**Source ordering gap plus unverified provider gate. Owner: billing/backend engineering.**

The checkout route verifies the user and validates tier/cycle. It returns 503 when purchase URLs are unconfigured. Current production billing environment metadata was not checked; the August report's missing-variable list is historical, not a fresh finding.

The webhook validates authorization, records event IDs, skips processed duplicates, and retries unprocessed events. However, [the ordering helper](../src/lib/revenuecat/reconciliation.ts), lines 308–328, rejects only a strictly earlier period end. A delayed event with the same period end can pass after a later cancellation/change. The handler also reads state and then upserts separately. Existing sequential tests do not prove safe concurrent delivery or same-period ordering.

Close with provider sandbox evidence for Free/Collector/Seller/Store transitions, monthly/annual changes, renewal, failed payment/grace/expiry, cancellation, refunds/revocation as supported by the actual channel, duplicate/delayed/missing events, same-period out-of-order events, simultaneous deliveries, and shared web/mobile account identity. Enforce entitlements server-side and provide a reconciliation path when an event never arrives. Record current purchase and management configuration without disclosing values.

### LC-07: Public market and feature claims are not launch-certified

**Confirmed initial-render/copy issues; provider reliability not established. Owner: public web/product.**

The live homepage's extracted initial HTML contains Connecting/fallback/Pending and loading market text. [MarketSection](../src/components/landing/MarketSection.tsx) initializes this state and fetches client-side without a request deadline. This observation does not prove that a hydrated browser remains stuck indefinitely. The local desktop screenshot test waits for the initial connecting text to disappear, but does not require useful market data.

Use the requested clearly labeled sample market snapshot, or verified cached data with an age/source label. Acceptance: meaningful first render, no dependence on provider completion for the public example, and deliberate timeout/429/unavailable states wherever live data is offered.

The live Store description includes employee workflows while the pricing matrix says employee accounts await configuration. Inventory/provider/automation claims need a per-feature availability ledger tied to actual supported behavior. Close each paid promise with evidence or conservative wording. Internal implementation labels remain Implemented / Partially Implemented / Planned / Requires Production Configuration; user-facing Available / Beta / Coming soon labels should derive from those reviewed facts.

### LC-08: Credential security wording is inconsistent; deployment evidence is missing

**Encryption implemented in source; production operation unverified. Owner: security/product.**

[Credential encryption](../src/lib/marketplaces/credentials.ts) uses AES-256-GCM with a random IV and rejects missing/short key configuration. [The credential save route](../src/app/api/marketplaces/credentials/route.ts) encrypts before storage and returns masked labels; GET selects labels and update time instead of ciphertext or plaintext. This is more substantial than an encryption recommendation.

The public trust section makes an implementation claim while `/security` uses aspirational wording. Align the statements with verified behavior. Before closing the P0 gate, demonstrate deployed encryption and owner-only access with disposable staging credentials, missing-key failure, corrupted-ciphertext failure, authorized use, and logs/browser-storage inspection. Verify key rotation/recovery handling; the stored key-version label alone does not prove a working rotation mechanism. No real credentials should appear in audit artifacts.

## P1 — launch operations and coverage

| ID | Finding / status | Required closure evidence |
| --- | --- | --- |
| LC-09 | Root lint gate fails; **confirmed** | Resolve applicable errors and reconcile root/mobile lint scope; rerun the canonical validation command on the final clean release commit. |
| LC-10 | Authenticated device test configuration is incomplete; **source finding** | Both authenticated Playwright helpers call `browser.newContext` with only base URL/storage state, omitting project viewport/device options. Use a fixture/context inheriting the intended project configuration and assert actual viewport/device behavior. Otherwise a mobile project label does not certify a mobile layout. |
| LC-11 | Monitoring and activation funnel; **Planned / Requires Production Configuration** | No application integration or named activation events were found in the inspected source/package/layout paths. Confirm external monitoring separately. Instrument failures for API/auth/import/provider/billing and alert receipt; track signup → verification → onboarding → first persisted card → checkout → subscription, including Time to First Card and deduplication. Avoid private card images/credentials in telemetry. |
| LC-12 | Health check; **Planned** | No `src/app/api/health` handler exists. Public `/api/health` returns 401 through auth handling, not a verified dependency-health response. Implement a minimal, non-secret health signal with appropriate access and alerting. |
| LC-13 | Recovery; **Requires Production Configuration** | Record backup retention, restore target/RPO/RTO, migration remediation, and deployment rollback. Execute a restore drill into an isolated target and verify inventory/locations/movements and access policies. No restoration was attempted here. |
| LC-14 | Onboarding, empty states, and first-card journey; **Partially Implemented** | Onboarding already asks account type and modules; it is not absent. Test first-use routes with zero records and send users to a chosen actionable workflow. Exercise scan/confirm/add, manual add, import, storage/move, deck ownership, and sale/reporting with actual accounts. |
| LC-15 | Large inventories; **source risk, not load-tested** | `loadInventorySnapshot` selects rows without pagination. Validate behavior beyond the deployed Supabase row cap and during multi-chunk writes; the actual cap was not inspected. Confirm counts, export completeness, query plans, and representative dashboard latency. |
| LC-16 | Support/privacy operations; **Requires Production Configuration** | Confirm support receipt, deletion/export fulfillment, and actual processor/retention inventory. Provision and verify domain mailboxes before replacing public addresses. Legal suitability requires qualified review; this audit makes no legal certification. |
| LC-17 | Native release; **uncertified** | Run strict release configuration, Expo Web export, native builds, and physical iOS/Android auth/scanner/offline replay/billing tests. The current non-strict release script result does not certify these. |
| LC-18 | Accessibility and full navigation coverage; **Partially Implemented** | Existing smoke tests check named controls and document overflow. Add keyboard-only flows, focus/error announcements, contrast and touch-target review, authenticated CTA/dead-route checks, and meaningful assertions for provider error states. WebKit interaction skips must be closed or explicitly bounded. |

Security headers are configured and returned by production, including CSP, HSTS, frame denial, and nosniff. This is positive evidence, not blanket security approval. The global permissions policy denies camera access; any future browser camera workflow needs an explicit policy review. No active web `getUserMedia` call was found, so this is not labeled a reproduced scanner regression.

## P2 — after core certification

1. Reduce homepage repetition while preserving the scan-to-sale lifecycle and plan progression.
2. Replace conceptual product examples with truthful screenshots of supported workflows; label all sample data.
3. Build focused search-intent landing pages only for supported product behavior; verify metadata/canonical links and indexing for each.
4. Add help content for import errors, exact printings, inventory recovery, billing, and permissions. Publish testimonials only when authentic and authorized.

These are Planned improvements, not reasons to begin another broad redesign during the launch freeze.

## Fresh public HTTP observations

Read-only requests on September 6, 2026; [machine-readable results](../.launch-audit/public-http.json).

| Route on `https://www.tradingdocks.com` | Result |
| --- | --- |
| `/`, `/pricing`, `/sign-up?plan=seller`, `/security`, `/privacy`, `/terms` | 200 |
| `/sitemap.xml`, `/robots.txt` | 200 — the August sitemap 404 is no longer reproduced. |
| `/dashboard` | 307 to `/sign-in?next=%2Fdashboard` |
| `/api/health` | 401; not evidence of dependency health. |

Live source references: [homepage](https://www.tradingdocks.com/), [paid-intent signup](https://www.tradingdocks.com/sign-up?plan=seller), [security page](https://www.tradingdocks.com/security). These observations are specific to this date; local and deployed source equivalence was not established.

## Release sequence and required inputs

1. Fix LC-01 and LC-02 in focused inventory hardening changes; retain failure/concurrency tests. Submit any needed database migration as a concrete proposal for explicit approval before application.
2. Fix paid intent, public market/copy, and applicable validation errors. Preserve the accepted product architecture and RevenueCat authority.
3. Establish a named staging URL/project and disposable User A/User B workspaces, plus tier and trusted-admin QA accounts supplied through secure test configuration. No plaintext credentials belong in chat or docs.
4. Correct browser context coverage, then execute isolation, session, mutation, and provider sandbox matrices. Record test identity, environment, commit, date, expected/actual result, and sanitized evidence for every gate.
5. Certify production configuration, monitoring/alerting, support, and restore/rollback operations; complete device evidence for whichever platforms will launch.
6. Re-run canonical checks on a frozen clean candidate. Proceed from internal QA to private beta, soft launch, public launch, and paid acquisition only when each stage's gates are met.

Release approval requires **zero open P0s**, explicit acceptance of any remaining P1s, and evidence for the actual candidate/deployment. No percentage-based launch readiness or claim that the full repository is certified is justified by this run.
