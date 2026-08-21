# Trading Docks Beta Release Readiness

Status labels:

- Complete: validated by automated checks or code review in this pass.
- Needs QA: code is wired, but a representative authenticated browser/device walkthrough is still required.
- Blocked: cannot be validated without a real environment, account, credential, device, or external provider.
- Follow-up: not release blocking for closed beta unless reproduced as P0/P1.

## Current Pass

- Branch: `codex/production-launch-hardening`
- Goal: prepare Trading Docks for systematic closed-beta validation without changing pricing, weakening authorization, touching production data, or applying destructive migrations.
- Current release posture: code/static validation is passing; the product must not be called production-ready until the real-account QA matrix below passes.
- Related production launch audit: `docs/PRODUCTION_LAUNCH_AUDIT.md`.
- Account isolation and entitlement QA matrix: `docs/ACCOUNT_ISOLATION_ENTITLEMENT_QA.md`.
- Billing provider QA matrix: `docs/BILLING_PROVIDER_LAUNCH_QA.md`.
- Deployed product/mobile QA matrix: `docs/DEPLOYED_PRODUCT_MOBILE_QA.md`.
- Premium product polish inventory: `docs/PREMIUM_PRODUCT_POLISH.md`.

## Automated Validation Baseline

- Complete: root TypeScript passes with `npm run typecheck`.
- Complete: root unit tests pass with `npm test`.
- Complete: focused dashboard/auth/public UI tests pass.
- Complete: Playwright public browser QA passes with Chromium, Firefox, WebKit, tablet, and mobile projects via `npm run test:e2e`.
- Complete: authenticated Playwright QA is wired through environment-provided credentials and local `.playwright-auth/` storage state files, but no authenticated account was exercised in this environment.
- Complete: public screenshot baselines cover homepage desktop, homepage mobile, and pricing desktop.
- Complete: focused lint passes with `npm run lint -- --quiet`.
- Complete: full production build passes with `npm run build`.
- Complete: `git diff --check` passes.
- Complete: `.next/` generated artifacts are not tracked by Git.

## Preview/Staging Deployment Readiness

- PASS: production build passes locally and emits the active app route manifest.
- PASS: public Supabase clients use `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`; mobile uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- PASS: trusted server-only Supabase access is isolated to `SUPABASE_SERVICE_ROLE_KEY` through server/admin code paths.
- PASS: committed secret scan found placeholders, documentation, SQL grants, and server env references only; no live production secret values were found in tracked source.
- PASS: `VERCEL_ENV`, not `NODE_ENV` alone, is used for production host canonicalization so Vercel Preview can remain on its preview hostname.
- PASS: development URLs are not required for deployed auth redirects; local fallback remains `http://localhost:3000` for local development only.
- PASS: `.env.local.example` documents safe placeholder names for required Supabase, RevenueCat, email, catalog, marketplace, and optional AI/provider configuration.
- PASS: destructive production database operations are not required for this beta QA checkpoint.
- BLOCKED: preview deployment must be pointed at a safe Supabase environment before real-account QA. Do not run representative write tests against production customer data.
- BLOCKED: external integrations require sandbox/test credentials to validate live failure and success paths.

## Real QA Run Ledger

Use this ledger for deployed-environment QA. Result must be `PASS`, `FAIL`, `BLOCKED`, or `NOT APPLICABLE`.

| Result | Account tier | Route | Browser/device | Action | Expected | Actual | Severity | Fix commit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BLOCKED | Free | `/sign-in`, `/dashboard` | Deployed browser | Log in and verify Free dashboard/navigation | Free user can sign in, sees Free surface only, and premium routes are blocked | Representative Free account/browser session not available in this coding environment | P1 until tested | N/A |
| BLOCKED | Collector | `/dashboard/inventory`, `/dashboard/deck-vault`, `/dashboard/collector-portfolio` | Deployed browser | Verify Collector workspace and persistence | Collector can use Collection, Deck Vault, Portfolio, and plan limits correctly | Representative Collector account/browser session not available in this coding environment | P1 until tested | N/A |
| BLOCKED | Seller | `/dashboard`, `/dashboard/purchasing-intelligence`, `/dashboard/orders`, `/dashboard/marketplaces` | Deployed browser | Verify Seller command center, workflows, and integration states | Seller sees seller surface and graceful disconnected/provider states | Representative Seller account/browser session not available in this coding environment | P1 until tested | N/A |
| BLOCKED | Store | `/dashboard`, `/dashboard/customers`, `/dashboard/card-shows`, `/dashboard/inventory`, `/dashboard/orders` | Deployed browser | Verify Store operations and safe writes | Store sees full store workspace and writes persist after refresh/sign-in | Representative Store account/browser session not available in this coding environment | P1 until tested | N/A |
| BLOCKED | Owner/Admin | `/dashboard/admin`, `/dashboard/admin/catalog/tcgplayer`, `/dashboard/label-studio` | Deployed browser | Verify full platform surface and no billing-tier restriction | Trusted platform role gets full access without exposing it to ordinary accounts | Representative Owner/Admin browser session not available in this coding environment | P1 until tested | N/A |
| BLOCKED | Any two accounts | Collection, Purchasing, CRM, Label Studio | Deployed browser | Create/read/update/delete safe non-production test records | Each account sees only its own workspace records | Safe non-production accounts and Supabase environment not available in this coding environment | P0 until tested | N/A |
| BLOCKED | Mobile accounts | Native app | Physical iOS/Android | Validate native auth, scanner, session restore, offline replay, deep links, purchase restore | Native workflows pass on actual builds/devices | Physical-device validation not run in this web-focused coding environment | P1 if mobile is in beta scope | N/A |

## Fixes Completed In This Readiness Branch

- Complete: generic dashboard scaffold empty states no longer imply live data before workspace records activity.
- Complete: generic dashboard scaffold no longer renders decorative fake progress bars for zero-data routes.
- Complete: Automation route now renders a beta empty state with clear operational entry points instead of a header-only workspace.
- Complete: Customer CRM empty state no longer exposes an inactive CSV import CTA.
- Complete: Mission Control Preview is removed from production navigation and the direct route redirects to the dashboard instead of showing hard-coded preview metrics.
- Complete: shared dashboard page headers render primary action buttons only when a real handler is wired.
- Complete: Tasks, Reports, Vendors, Supplies, and Payroll no longer display non-functional primary actions.
- Complete: Tasks, Vendors, and Supplies use direct empty states instead of hidden empty-array template loops.
- Complete: auth redirect origin construction is normalized so scheme-bearing forwarded hosts cannot produce malformed `https://https://...` callback URLs.
- Complete: Store/Owner dashboard navigation no longer repeats the same route in multiple sidebar sections.
- Complete: trusted Admin navigation uses the same full-platform access authority as Owner instead of hiding Seller/Store tools behind the raw billing tier.
- Complete: dashboard chrome now consumes canonical platform access for Admin links and presents Owner/Admin as full platform access while preserving the commercial billing plan.
- Complete: Analytics composes Owner/Admin views from trusted platform authority instead of raw billing tier.
- Complete: Analytics inventory aging uses real row timestamps for recent inventory and no longer renders broken encoded separators.
- Complete: Card Shows buying-cart drafts persist to workspace account documents, with legacy localStorage only used for one-time migration cleanup.
- Complete: Purchasing Intelligence Current Purchase drafts persist to workspace account documents, with legacy sessionStorage only used for one-time migration cleanup.
- Complete: Settings > Data & Privacy no longer exposes inert export/backup/deletion controls. Export and account deletion are labeled support-assisted during beta, inventory backup links to the CSV tool, and deletion opens a prefilled support request.
- Complete: Direct scanner-provider and Trade Binder share API calls now enforce shared capability checks instead of relying on UI visibility or authentication alone.
- Complete: web and mobile effective access now resolve RevenueCat provider state and explicit membership overrides through one shared billing resolver before falling back to legacy billing rows.
- Complete: stale RevenueCat webhook events with older provider periods no longer overwrite newer subscription state.
- Complete: dashboard mobile sidebar now locks background page scroll while the menu is open and restores scrolling on close/unmount.
- Complete: public header navigation now has a tablet-safe compact drawer below `xl`, explicit same-page section scrolling, and named navigation landmarks for accessibility/testing.
- Complete: public footer logo sizing no longer creates browser-level horizontal overflow.
- Complete: Playwright E2E scripts and artifact ignores are in place for launch QA.
- Complete: dashboard account/workspace controls expose stable accessible names for browser automation without changing visible product behavior.
- Complete: shared dashboard headers and metric cards have tighter premium proportions, readable caption sizing, and named primary action controls.
- Complete: Orders now has clearer primary/secondary action hierarchy, less decorative chrome, named row controls, and a more truthful no-orders state.
- Complete: Customer CRM detail/configuration panels have more readable labels plus named loyalty, delete, and close controls.

## Closed-Beta QA Matrix

| Surface | Free | Collector | Seller | Store | Owner/Admin | Required checks |
| --- | --- | --- | --- | --- | --- | --- |
| Public website | Public | Public | Public | Public | Public | Landing, pricing, legal links, signup CTA, mobile layout, SEO metadata, no placeholder copy. Automated public Playwright matrix passes; deployed walkthrough still recommended. |
| Auth | Sign in/up/reset | Sign in/up/reset | Sign in/up/reset | Sign in/up/reset | Sign in/up/reset plus Command Center entry | Email/password, magic link, OAuth redirects, malformed origin prevention, logout, refresh restore. |
| Dashboard shell | Free modules only | Collector modules | Seller modules | Store modules | Full platform surface | Sidebar, mobile nav, topbar menus, active route state, no duplicate routes, no dead actions. |
| Collection | Read/write own collection within Free limits | Unlimited Collector capabilities | Same core collection plus Seller tools | Same core collection plus Store tools | Full access without fake paid plan | Ownership isolation, pagination/search, storage cells, exact printing fields, missing price/image states. |
| Storage | Basic assignment where entitled | Full collector storage | Seller inventory location use | Store operations use | Full access | Assignment, clear/move, unassigned smart view, account isolation, persistence after refresh. |
| Deck Vault | Available | Available | Available | Available | Available | Import/build/detail, card image loading, no localStorage authority for account data. |
| Trade Binder/Wishlist | Limited by entitlements | Available | Available | Available | Available | Add/remove/status/priority, strict matching, offline/stale messaging if applicable. |
| Purchasing Intelligence | Locked or upgrade path | Locked or upgrade path | Available | Available | Available | Search, product images, add to current purchase, TCGplayer CSV conversion, condition/finish mapping. |
| Buying workflows | Locked or upgrade path | Locked or upgrade path | Available | Available | Available | Bulk Buying, Collection Buying, Sealed, Precon, Buylist, Purchase History persistence. |
| Orders/Marketplaces | Locked | Locked | Available | Available | Available | Connected vs disconnected states, import/reconciliation errors, no misleading zeroes. |
| Business Command Center | Hidden | Hidden | Seller operating snapshot | Store expanded operations | Full command center | Workspace-scoped metrics, no cross-account data, no raw-tier gating. |
| CRM/Operations | Hidden | Hidden unless capability allows | Partial operations | Store operations | Full operations | Customers, tasks, calendar, vendors, supplies, employees, payroll, reports empty/non-empty states. |
| Label Studio | Hidden | Hidden | `label.view` gated | `label.view` gated | Full access | `/dashboard/label-studio`, API, QR route, selected inventory, print preview, persistence. |
| Admin | Hidden | Hidden | Hidden | Hidden | Visible by trusted platform role | User roles, feature access, catalog imports, system health, no email bypass. |
| Billing | RevenueCat web flow | RevenueCat web flow | RevenueCat web flow | RevenueCat web flow | Displays billing truth separately from platform authority | Purchase links, portal links, webhook reconciliation, stale-event ordering, no stale legacy billing-row access, no client-granted paid access. |
| Mobile app | Auth and Free nav | Collector nav/scanner | Seller nav/actions | Store nav/actions | Additive admin access where supported | Native auth, session restore, scanner, offline queue, safe-area nav, menu scroll lock, device-only checks. |

## Persistence And Account-Isolation Checks

- Complete: active dashboard shell resolves user access server-side through Supabase-backed platform authority before rendering protected chrome.
- Complete: Card Shows buying drafts now persist through `workspace_documents`; browser storage is used only to migrate and remove the old draft key.
- Complete: Purchasing Intelligence Current Purchase drafts now persist through `workspace_documents`; browser storage is used only to migrate and remove the old session draft key.
- Needs QA: Collection, Deck Vault, Storage, Trade Binder, Wishlist, Purchasing, Orders, CRM, Label Studio, and Admin Catalog must be exercised with two different authenticated accounts to confirm no cross-account reads or writes.
- Needs QA: account-document drafts should be refreshed, signed out, and re-opened in representative workspaces to confirm the intended persistence level is clear to users.
- Follow-up: older `src/components/dashboard-v2` modules still contain browser-storage persistence paths and should be archived or deleted after active import references are fully audited.

## Premium Product Polish Gate

- Complete: source-level polish pass improved the shared dashboard header, metric-card primitive, Orders, and Customer CRM without changing business logic or permissions.
- Needs QA: authenticated screenshots and interaction walkthroughs are still required for Inventory, Orders, CRM, Analytics, Deck Architect, Deck Vault, Label Studio, and Admin with representative populated accounts.
- Needs QA: mobile polish remains physical-device-bound; this pass did not modify or verify native Expo screens.
- Follow-up: the detailed P1/P2 polish backlog lives in `docs/PREMIUM_PRODUCT_POLISH.md`.

## Integration Failure Handling Checks

- Needs QA: RevenueCat web checkout, customer portal, mobile login identity, provider status transitions, stale event ordering, and webhook reconciliation with real sandbox/test events.
- Needs QA: Supabase Storage-backed TCGplayer catalog import retry/failure states, including failed batch recovery and no duplicate catalog rows.
- Needs QA: TCGTracking provider health, SKU enrichment, pricing fallback, scanner provider failure states, and image fallback behavior.
- Needs QA: marketplace integrations distinguish disconnected channels from true zero activity.
- Needs QA: email delivery templates and redirect URLs for staging/preview and production domains.

## Environment Variable Checklist

Required for web Preview/Production:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` for trusted server-only admin routes, webhooks, imports, and reconciliation.
- `NEXT_PUBLIC_SITE_URL` and/or `NEXT_PUBLIC_APP_URL` for deployed redirects/email links.
- `REVENUECAT_WEBHOOK_AUTHORIZATION` for `/api/webhooks/revenuecat`.
- At least one RevenueCat web purchase link: `REVENUECAT_WEB_PURCHASE_LINK` or the package-specific `REVENUECAT_WEB_COLLECTOR_MONTHLY_URL`, `REVENUECAT_WEB_COLLECTOR_YEARLY_URL`, `REVENUECAT_WEB_SELLER_MONTHLY_URL`, `REVENUECAT_WEB_SELLER_YEARLY_URL`, `REVENUECAT_WEB_STORE_MONTHLY_URL`, `REVENUECAT_WEB_STORE_YEARLY_URL`.
- RevenueCat management link: `REVENUECAT_WEB_CUSTOMER_PORTAL_URL` or `REVENUECAT_WEB_MANAGEMENT_URL`.

Required only for local/deployed Playwright authenticated QA:

- `PLAYWRIGHT_AUTH_EMAIL`
- `PLAYWRIGHT_AUTH_PASSWORD`
- Optional tier-specific pairs: `PLAYWRIGHT_FREE_EMAIL` / `PLAYWRIGHT_FREE_PASSWORD`, `PLAYWRIGHT_COLLECTOR_EMAIL` / `PLAYWRIGHT_COLLECTOR_PASSWORD`, `PLAYWRIGHT_SELLER_EMAIL` / `PLAYWRIGHT_SELLER_PASSWORD`, `PLAYWRIGHT_STORE_EMAIL` / `PLAYWRIGHT_STORE_PASSWORD`, `PLAYWRIGHT_OWNER_EMAIL` / `PLAYWRIGHT_OWNER_PASSWORD`.
- Generated Playwright session state is written to `.playwright-auth/`, which is environment-local and gitignored.

Required for transactional beta invitations:

- `RESEND_API_KEY`
- `RESEND_FROM_EMAIL`

Optional integration/provider variables that should degrade gracefully when absent:

- `TCGTRACKING_API_KEY`, `TCGTRACKING_API_BASE_URL`, `TCGTRACKING_SCAN_BASE_URL`
- `JUSTTCG_API_KEY`
- `MANAPOOL_API_BASE_URL`, `MANAPOOL_INITIAL_SYNC_SINCE`
- `POKEMON_TCG_API_KEY`
- `POKEMON_JAPAN_MARKET_API_KEY`, `POKEMON_JAPAN_MARKET_ENDPOINT`
- `CLOUDFLARE_EMAIL_WEBHOOK_SECRET`
- `CRON_SECRET`
- `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY`, `MARKETPLACE_CREDENTIAL_KEY_VERSION`
- `OPENAI_API_KEY`, `OPENAI_DECK_DOCTOR_MODEL`, `OPENAI_VISION_MODEL`

Required for mobile beta builds if mobile is included in scope:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` for Android purchase/restore validation.

Forbidden in browser/mobile public env:

- `SUPABASE_SERVICE_ROLE_KEY`
- Any `EXPO_PUBLIC_*` or `NEXT_PUBLIC_*` value containing service-role credentials, `sb_secret`, webhook secrets, provider REST secrets, or private API keys.

## Closed-Beta Severity Gate

- P0: blocks sign-in, routes users to another account's data, grants unauthorized paid/admin access, corrupts data, crashes the app shell, or prevents checkout/webhook reconciliation. No P0 may ship.
- P1: prevents a core promised workflow for its eligible tier, loses user-entered account data unexpectedly, breaks navigation to a visible module, or shows materially false financial/inventory metrics. No open P1 should ship unless explicitly accepted.
- P2: visible polish, empty-state, copy, responsive, or integration error-state defects that do not block the workflow. May ship only with a tracked beta known issue.
- P3: minor copy, spacing, internal documentation, or developer-experience cleanup. May ship with backlog tracking.

## Native And Real-Environment Validation Still Required

- Blocked: physical iOS and Android validation was not run in this web-focused checkpoint.
- Needs QA: authenticated Playwright dashboard tests are available but require `PLAYWRIGHT_AUTH_EMAIL` and `PLAYWRIGHT_AUTH_PASSWORD` or tier-specific QA credentials. Current `npm run test:e2e` result without credentials: `86 passed`, `42 skipped`.
- Blocked: Expo scanner, native OCR/autolinking, offline replay, camera permissions, and RevenueCat native purchase restore require real devices or current preview builds.
- Blocked: representative Supabase staging accounts for Free, Collector, Seller, Store, Owner, and Admin are required before closing the matrix.
- Blocked: external provider tests require configured sandbox/test credentials and must not use production customer data.

## Beta Exit Criteria

- Every row in the Closed-Beta QA Matrix has a named tester, date, account type, environment, and result.
- No open P0 defects.
- No unaccepted P1 defects.
- All auth, billing, route-access, and account-isolation checks pass with real accounts.
- Production and Preview environment variables are documented and verified without printing secrets.
- A rollback plan exists for the web deployment and any already-applied Supabase migrations.
- Mobile release candidates are validated on physical iOS and Android devices before any public mobile beta expansion.
