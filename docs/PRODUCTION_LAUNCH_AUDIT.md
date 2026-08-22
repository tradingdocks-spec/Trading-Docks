# Trading Docks Production Launch Audit

Status labels:

- Complete: verified by code review and automated checks in this pass.
- Fixed: launch issue corrected in this branch.
- Needs QA: code path exists, but requires representative accounts, credentials, device, or deployed environment.
- Blocked: cannot be validated safely from the local repository alone.
- Follow-up: not a beta launch blocker unless reproduced as a user-facing failure.

## Current Checkpoint

- Branch: `codex/production-launch-hardening`
- Scope: public website, authenticated web app, admin surfaces, mobile readiness indicators, persistence/account isolation, and production-quality interaction audit.
- Launch posture: public browser automation is established and passing for representative unauthenticated routes. Authenticated browser QA is now wired with environment-provided credentials and reusable local storage state, but no real authenticated accounts were exercised in this coding environment. Real account isolation, billing/provider, mobile device, and deployed-environment QA remain P0/P1 launch gates before calling the product production-ready.
- Account isolation and entitlement matrix: `docs/ACCOUNT_ISOLATION_ENTITLEMENT_QA.md`.
- Billing/provider QA matrix: `docs/BILLING_PROVIDER_LAUNCH_QA.md`.
- Deployed product/mobile QA matrix: `docs/DEPLOYED_PRODUCT_MOBILE_QA.md`.
- Premium product polish inventory: `docs/PREMIUM_PRODUCT_POLISH.md`.
- Performance production readiness: `docs/PERFORMANCE_PRODUCTION_READINESS.md`.

## Route And Product Surface Inventory

| Surface | Active paths | Status | Notes |
| --- | --- | --- | --- |
| Public website | `/`, `/pricing`, legal pages, auth entry points | Complete | Playwright public-smoke runs Chromium, Firefox, WebKit, tablet, and mobile route checks with browser-error and overflow monitoring. |
| Authentication | `/sign-in`, `/sign-up`, `/forgot-password`, `/update-password`, Supabase callback flows | Needs QA | Public auth routes/forms are covered by Playwright; live email/OAuth/password flows need deployed validation. |
| Dashboard shell | `/dashboard/*` via `src/app/dashboard` | Needs QA | Canonical navigation/access tests exist. Playwright authenticated shell/mobile drawer/route matrix tests are credential-gated; real Free/Collector/Seller/Store/Owner sessions still need walkthroughs. |
| Collector workspace | Collection, Deck Vault, Portfolio, Storage, Trade Binder, Wishlist | Needs QA | Exact-printing and workspace persistence paths exist. Cross-account CRUD verification needs representative accounts. |
| Seller/Store operations | Purchasing, Orders, Marketplaces, Customers, Card Shows, Operations | Needs QA | Empty/disconnected states are improved, but marketplace/provider success and failure states require sandbox/live credentials. |
| Admin/Owner | Command Center, catalog imports, access controls, system health | Needs QA | Trusted platform role authority is present; admin browser QA still required. |
| Label Studio | `/dashboard/label-studio`, `/api/label-studio`, `/q/[token]` | Needs QA | Route and API exist. Production migration/application remains a controlled external step. |
| Mobile Expo app | `mobile/` | Blocked | Mobile code and release checks exist, but physical-device auth/scanner/offline QA was not run in this web-focused pass. |

## Launch Severity Register

| Severity | Finding | Status | Resolution / Owner |
| --- | --- | --- | --- |
| P0 | Account isolation for writes and reads must be verified with at least two real non-production accounts across Collection, Purchasing, CRM, Label Studio, and Admin read surfaces. | Blocked | Requires safe staging/preview Supabase accounts and browser QA. Do not run destructive tests against production customer data. Manual procedure is documented in `docs/ACCOUNT_ISOLATION_ENTITLEMENT_QA.md`. |
| P0 | Deck Architect repaired engine must be certified in the actual authenticated rendered product before it can move from fail to pass. | Blocked | Engine/source tests pass for Pauper and Krenko, but no Playwright QA credentials were available in this shell. Manual browser checklist is documented in `docs/PRODUCTION_LAUNCH_CERTIFICATION.md`. |
| P0 | Production database migrations must not be applied from this audit. | Complete | This pass only inspected source and changed web UI/test/docs. |
| P1 | Web Settings > Data & Privacy exposed data/deletion actions as clickable controls even though full self-service export/deletion is still support-assisted. | Fixed | Replaced inert buttons with honest support-assisted status, a real CSV converter destination, and a prefilled support mailto deletion request. |
| P1 | Scanner provider and Trade Binder share APIs were protected by authentication/owned-row checks, but not fully aligned with the capability registry for direct API calls. | Fixed | `/api/scanner/tcgtracking` now enforces `scanner.use`; `/api/binder-shares` now enforces `binder.manage` before mutation. |
| P1 | RevenueCat, catalog import, marketplace, email, and TCGTracking integrations require real configured environments to validate success/failure behavior. | Needs QA | Keep provider-specific smoke tests in the beta ledger. |
| P1 | RevenueCat provider state could previously be bypassed by a stale paid row in `billing_subscriptions` during effective access resolution. | Fixed | Added central billing access resolution for web/mobile so active Apple/Google provider rows and explicit manual overrides are authoritative; legacy billing rows are compatibility fallback only when no provider authority exists. |
| P1 | Older RevenueCat webhook events could overwrite a newer provider-subscription period if delivered out of order. | Fixed | Older incoming `current_period_end` values no longer replace newer stored provider state. |
| P1 | Mobile native scanner/auth/offline replay must be tested on physical iOS/Android builds if mobile is in beta launch scope. | Blocked | Requires device builds and representative accounts. Manual matrix is documented in `docs/DEPLOYED_PRODUCT_MOBILE_QA.md`. |
| P1 | Authenticated dashboard performance has not been measured with representative populated accounts. | Needs QA | Public production-mode routes were measured and fixed in `docs/PERFORMANCE_PRODUCTION_READINESS.md`; Free/Collector/Seller/Store/Owner dashboard timing and query-plan validation remain required. |
| P1 | Production Web Vitals/error monitoring is not yet confirmed. | Needs QA | Add deployed Core Web Vitals and error monitoring before expanding beyond closed beta. |
| P1 | Public site tablet navigation had a breakpoint gap where primary nav links were hidden and the hamburger menu was unavailable. | Fixed | Header now uses the compact drawer below `xl` and same-page section links perform explicit hash/scroll navigation. |
| P1 | Public routes crashed in local production when public Supabase web config was absent because middleware/homepage code created Supabase clients unnecessarily. | Fixed | Public routes now skip session lookup when safe and render without crashing; protected routes still fail closed when auth config is missing. |
| P2 | Public/auth logo images requested oversized optimized variants. | Fixed | Logo/mark dimensions and `sizes` hints were tightened; measured public routes now request small optimized mark variants instead of `w=1080`. |
| P2 | Public market feed participated in the homepage waterfall through a no-store browser fetch. | Fixed | Market feed now uses cacheable public semantics with browser/server cache headers and stale-while-revalidate. |
| P2 | Footer logo and dense public tables/decorative elements exposed unhelpful horizontal-overflow regressions during browser automation. | Fixed | Footer logo dimensions are constrained; Playwright overflow checks now fail page-level leaks while allowing intentional table-internal scroll containers. |
| P2 | Dashboard account controls lacked stable accessible names for authenticated browser QA selectors. | Fixed | Topbar workspace/account menu controls now expose explicit labels without changing visible layout. |
| P2 | Orders and Customer CRM had prototype-like dashboard proportions: oversized decorative surfaces, tiny captions, and several unnamed row/modal controls. | Fixed | Shared headers/metric cards, Orders, and Customer CRM now use tighter proportions, clearer action hierarchy, and stable accessible labels. Authenticated visual QA is still required. |
| P2 | Legacy `src/components/dashboard-v2` modules still contain browser-storage persistence and increase code-search noise. | Follow-up | Do a dedicated import audit before archiving/deleting; do not remove from this launch-hardening branch. |
| P2 | Older backup mobile folders and historical snapshots should remain excluded from active tooling and not be treated as launch source. | Complete | Active paths remain `src/` for web and `mobile/` for Expo. |
| P2 | Design-system overlap remains between older dashboard primitives and newer Trading Docks primitives. | Follow-up | Consolidate incrementally where product surfaces are touched; avoid broad redesign churn in launch hardening. |
| P3 | EDHREC integration and some advanced offline/pagination follow-ups are documented as future/product decisions. | Follow-up | Not a closed-beta blocker unless a surfaced workflow claims unavailable behavior. |

## Persistence And Browser Storage Review

Reviewed usage categories:

- Account-owned active drafts: Card Shows and Purchasing Current Purchase use Supabase-backed `workspace_documents`, with browser storage only for one-time legacy migration cleanup.
- Deck Vault: browser storage is limited to legacy migration and local recovery buffers; it should not be treated as authoritative account storage.
- Auth and mobile storage: local/SecureStore adapters are expected for Supabase sessions and remembered-email UX.
- Sidebar and quick-create preferences: localStorage is UI-only state and does not grant authorization or entitlement.
- Legacy `dashboard-v2`: still contains local browser persistence paths and should be archived after import verification.

## Design And Interaction Review

- Fixed: Settings data/privacy actions no longer look like fully wired product operations when the backend process is support-assisted.
- Fixed: Direct scanner-provider and binder-share API calls now enforce the same entitlement capabilities used by UI/navigation.
- Fixed: shared dashboard page headers and metric cards now use calmer proportions, readable caption sizing, and named primary actions.
- Fixed: Orders now presents a denser premium operating surface with clearer primary/secondary actions, less decorative chrome, named selection/expand controls, and a more honest empty state.
- Fixed: Customer CRM panels and forms now use more readable labels and named loyalty/delete/close controls.
- Needs QA: every primary CTA in Seller/Store/Owner workspaces should be clicked in browser sessions to confirm it either performs an action, opens a real route, or is deliberately absent.
- Fixed: public website route-smoke and responsive checks now run at 1920, 1440, 1280, 1024, 768, 430, 390, and 375 widths through Playwright.
- Complete: authenticated Playwright setup can create local `.playwright-auth/` storage states from environment-provided credentials without committing tokens.
- Needs QA: authenticated responsive browser QA remains required for dashboard shell, Settings, Collection, Purchasing, Orders, Label Studio, and Admin because no QA credentials were present in the current run.
- Blocked: Deck Architect rendered-result certification remains required with authenticated QA data. Automated engine checks prove the repaired paths, but the product cannot be marked PASS until the Pauper and Krenko browser scenarios in `docs/PRODUCTION_LAUNCH_CERTIFICATION.md` are executed.
- Follow-up: continue removing old generic placeholder language only when replacing it with accurate product state, not decorative copy.
- Follow-up: continue the P1/P2 premium polish inventory in `docs/PREMIUM_PRODUCT_POLISH.md`; authenticated screenshots were not captured in this environment.

## Accessibility And Responsive Gates

Required before production launch:

- Keyboard traversal of public header, auth forms, dashboard sidebar/topbar, modals, dropdowns, Settings, Collection filters, Purchasing search, and Admin tables.
- Visible focus states on all actionable dashboard controls.
- Error states that are textual and not color-only.
- Mobile viewport checks for no clipped tabs, no hidden primary actions, and no overflow in dense dashboards.

## Production Completion Checklist

| Area | Launch state | Required next proof |
| --- | --- | --- |
| Automated web validation | Complete after this branch passes validation | `npm test`, typecheck, lint, build, Playwright E2E, `git diff --check`. |
| Public website | Complete for automated browser smoke | Deployed preview walkthrough is still recommended, but local production-mode Playwright public matrix now passes. |
| Auth | Needs QA | Password, magic link/OAuth if enabled, reset, callback origins, logout, refresh restore. Playwright storageState reuse is ready once credentials are provided. |
| Data isolation | Blocked | Two-account workspace CRUD and admin read tests in non-production project. |
| Deck Architect | Blocked | Run authenticated browser certification for Pauper / Collection Optimized / Competitive and Commander / Krenko, Mob Boss; engine tests alone are insufficient for PASS. |
| Billing | Needs QA | RevenueCat checkout/portal/webhook sandbox events and entitlement refresh. |
| Admin | Needs QA | Owner/Admin Command Center and role-gated routes in deployed preview. |
| Mobile | Blocked | Physical-device iOS/Android build validation. |
| Observability | Needs QA | Confirm actionable API errors for catalog/import/webhook/provider failures in Vercel logs and UI. |
| Performance | Needs QA | Public route baseline is fixed and documented; authenticated dashboard and large-workspace performance still need deployed account validation. |

## Safe Launch Order

1. Merge only validated, focused hardening branches into a release candidate branch.
2. Deploy Preview pointed at safe Supabase staging/preview variables.
3. Run the real-account QA ledger in `docs/BETA_RELEASE_READINESS.md`.
4. Validate provider credentials and failure states without production customer mutation.
5. Validate mobile builds separately if mobile is in launch scope.
6. Promote only after P0/P1 items are pass or explicitly accepted as beta limitations.
