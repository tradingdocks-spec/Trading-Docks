# Deployed Product And Mobile QA

Status labels:

- Automated: verified by source inspection, unit/static tests, TypeScript, lint, or production build in this branch.
- Browser emulation: may be verified with local/preview browser viewports, but is not a physical device result.
- Real device: must be run on the named hardware/browser by a tester.
- Blocked: requires deployed credentials, representative accounts, external providers, or physical devices.

## Scope

This checklist covers production-launch UI behavior for the existing Trading Docks product. It is not a redesign backlog. It tracks representative public, dashboard, admin, and mobile surfaces that exercise navigation, responsive layout, data-dense workflows, forms, tables, overlays, card imagery, empty states, and entitlement consistency.

## Representative Route Matrix

| Family | Route | Why it is representative | Current validation |
| --- | --- | --- | --- |
| Public | `/` | Public hero, pricing/story entry, market demo, CTA flow, responsive marketing sections. | Automated Playwright public-smoke and visual baseline coverage across Chromium, Firefox, and WebKit projects. |
| Public | `/pricing` | Public plan comparison, RevenueCat upgrade links, conversion CTAs. | Automated Playwright public-smoke and desktop visual baseline coverage; provider checkout QA still required. |
| Auth | `/sign-in` | Login form, OAuth/password UI, redirect origin behavior. | Automated Playwright form-rendering/password-toggle coverage in Chromium/Firefox; live auth QA required. |
| Auth | `/sign-up` | Create-account conversion form, plan/billing query handling. | Automated Playwright form-rendering coverage; live signup email/provider QA required. |
| Auth | `/forgot-password` and `/update-password` | Email form, reset callback state, validation messages. | Automated Playwright route-smoke coverage; live email QA required. |
| Dashboard shell | `/dashboard` | Tier-aware home, sidebar, topbar, bottom nav, Owner/Admin full-access display. | Automated access/shell tests; representative browser QA required. |
| Inventory | `/dashboard/inventory` and `/dashboard/inventory/[cardId]` | Dense tables/cards, search/filter, images, storage column, detail route. | Automated collection/inventory tests; two-account browser QA required. |
| Orders | `/dashboard/orders` | Data table, status filters, disconnected marketplace states, order actions. | Automated route/build coverage; provider/account QA required. |
| Analytics | `/dashboard/analytics` | Data-dense metrics, charts/captions, role-aware content. | Automated source/build coverage; populated account QA required. |
| CRM | `/dashboard/customers` | Forms, empty state, customer list/detail behavior. | Automated dead-CTA coverage; browser form QA required. |
| Deck Architect | `/dashboard/deck-architect` | Data-heavy deck recommendations, card search, text density. | Automated deck tests; browser/device legibility QA required. |
| Deck Vault | `/dashboard/deck-vault` and `/dashboard/deck-vault/decks/[deckId]` | Card imagery, deck list/table/card views, share/export, overlays. | Automated deck tests; image and touch QA required. |
| Imports/tools | `/dashboard/tools/csv-converter` and `/dashboard/admin/catalog/tcgplayer` | File/import UI, progress, errors, tables. | Automated importer tests; real storage/provider QA required. |
| Settings/billing | `/dashboard/settings`, `/dashboard/plans`, `/dashboard/billing/success` | Forms, billing display, portal/checkout states. | Automated billing source/tests; RevenueCat provider QA required. |
| Admin/Owner | `/dashboard/admin` | Owner/Admin navigation, command center, protected tools. | Automated access tests; deployed Owner/Admin browser QA required. |
| Label Studio | `/dashboard/label-studio` | Print workspace, selected inventory, QR route handoff. | Automated route/build coverage; staging data/browser QA required. |

## Viewport Matrix

These viewports must be exercised against the representative routes above.

| Viewport | Purpose | Current status |
| --- | --- | --- |
| 375 x 812 | Small modern iPhone class. | Browser emulation: automated WebKit route-smoke coverage. Real device required. |
| 390 x 844 | Common iPhone class. | Browser emulation: automated WebKit route-smoke plus homepage visual baseline. Real device required. |
| 430 x 932 | Large iPhone class. | Browser emulation: automated Chromium route-smoke, mobile menu, auth form, and overflow coverage. Real device required. |
| 768 x 1024 | iPad/tablet portrait. | Browser emulation: automated Chromium route-smoke, auth form, and responsive header coverage. |
| 1024 x 768 | Tablet landscape/small laptop. | Browser emulation: automated WebKit route-smoke and overflow coverage. |
| 1280 x 800 | Small desktop/laptop. | Browser emulation: automated Firefox route-smoke, auth form, and header navigation coverage. |
| 1440 x 900 | Primary desktop QA size. | Browser emulation: automated Chromium route-smoke and public visual baselines. |
| 1920 x 1080 | Wide desktop. | Browser emulation: automated Chromium route-smoke and header navigation coverage. |

Browser emulation must not be recorded as physical iPhone/Android validation.

## Device And Browser Matrix

| Environment | Required checks | Status |
| --- | --- | --- |
| iPhone Safari | Login, sidebar, bottom nav, tables, forms, card images, deck views, share/export, logout/login. | Real device required. |
| iPhone installed/PWA if applicable | Launch, session restore, safe-area navigation, keyboard behavior, share/export. | Real device required. |
| Android Chrome | Login, navigation, forms, tables, overlays, card images, logout/login. | Real device required. |
| Desktop Chrome | Public site, dashboard, data-dense tables, imports, billing, admin, keyboard/focus. | Deployed browser required. |
| Desktop Safari | Public site, dashboard, sticky/fixed elements, forms, tables, dialogs. | Real browser required. |

## Automated Validation

Completed in this checkpoint:

- `npm test`
- `npm run typecheck`
- `npx tsc --noEmit -p mobile/tsconfig.json`
- `npm --prefix mobile test`
- `npm run lint -- --quiet`
- `npm run build`
- `git diff --check`
- `git ls-files .next`

Browser emulation:

- Complete: Playwright is installed with Chromium, Firefox, and WebKit projects.
- Complete: `npm run test:e2e` runs public route smoke, browser-error monitoring, horizontal-overflow checks, auth form interaction checks, mobile public-menu checks, credential-gated authenticated dashboard shell tests, and visual baselines.
- Complete: the authenticated Playwright harness now creates reusable environment-local storage state files under `.playwright-auth/`; that directory is gitignored and must never be committed.
- Complete: screenshot baselines cover homepage desktop, homepage mobile WebKit, and pricing desktop.
- Complete: small-text audit attachments are generated for key public/auth routes to flag typography that should receive manual review instead of silently passing.
- Current run: `npm run test:e2e` completed with `86 passed` and `42 skipped`. The skips were expected: public interaction/visual tests are scoped to specific browser projects, and authenticated dashboard QA skipped because no Playwright QA credentials were present.
- Needs QA: authenticated dashboard tests are wired but skip unless `PLAYWRIGHT_AUTH_EMAIL` and `PLAYWRIGHT_AUTH_PASSWORD` or one of the tier-specific QA account pairs is provided.
- Needs QA: WebKit route rendering and overflow are covered; public header/menu click interactions are covered in Chromium/Firefox because local Playwright WebKit click/hash behavior was not stable enough to treat as physical Safari proof.

Automated coverage added:

- Dashboard mobile menu now sets and clears `body[data-dashboard-mobile-menu="open"]`.
- Global CSS locks page scroll/touch when the mobile dashboard menu is open.
- Mobile dashboard bottom navigation remains a five-cell layout with the fifth cell reserved for Menu.
- Dashboard account and workspace controls now expose stable accessible names for authenticated browser QA.
- Shared dashboard header/action and metric-card primitives now use tighter proportions and named controls for browser QA.
- Orders and Customer CRM received targeted premium-polish fixes for action hierarchy, caption legibility, and accessible row/modal controls.

## Defects Found And Fixed

| Severity | Defect | Fix |
| --- | --- | --- |
| P1 | Opening the mobile dashboard sidebar did not mark the page as scroll-locked, so background content could scroll underneath the drawer on touch devices. | `TieredDashboardShell` now toggles `body[data-dashboard-mobile-menu="open"]`; global CSS sets `overflow: hidden` and `touch-action: none` while open. |
| P1 | Public header had no full navigation path at tablet widths where desktop links were hidden but the hamburger was also hidden. | Public header now uses a compact drawer below `xl`, and in-page section links scroll/update the hash explicitly. |
| P2 | Footer logo could report intrinsic image width and trigger horizontal overflow in browser automation. | Footer logo now uses rendered dimensions that match the visible layout. |
| P2 | Orders and Customer CRM contained tiny captions, bulky panels, and unnamed row/modal controls that lowered perceived production quality. | Shared primitives plus Orders/CRM now use denser spacing, readable labels, clearer action hierarchy, and stable accessible names. |

## Known Remaining Issues / Manual Gates

| Severity | Item | Required proof |
| --- | --- | --- |
| P0 | Representative account isolation across two unrelated users/workspaces. | Deployed non-production accounts or carefully scoped production-safe test accounts. |
| P0 | RevenueCat checkout, portal, webhook, and web/mobile entitlement sharing. | Deployed provider sandbox/live QA with Supabase UUID identity confirmation. |
| P1 | Physical iOS/Android mobile navigation, keyboard, scanner, safe-area, and offline behavior. | Real devices or current mobile builds. |
| P1 | Authenticated responsive route matrix across all listed viewports. | Playwright public route matrix passes; authenticated route matrix needs credentials and representative accounts. |
| P1 | Data-dense tables for inventory, orders, analytics, CRM, imports, and admin. | Browser QA with empty and populated account states. |
| P1 | Deck Architect/Deck Vault image sharpness, card legibility, text view density, share/export. | Browser and real-device QA with a populated deck account. |
| P1 | Form keyboard behavior on mobile for auth, settings, CRM, inventory, purchasing, and billing. | Real iPhone/Android validation. |
| P2 | Remaining authenticated premium-polish backlog. | Track and close items in `docs/PREMIUM_PRODUCT_POLISH.md`; do not mark resolved without real browser/device proof where required. |

## Physical Device Manual Checklist

Record `PASS`, `FAIL`, `BLOCKED`, or `N/A` for each row with tester, date, device, browser/build, account tier, and notes.

| Workflow | Expected behavior |
| --- | --- |
| Login | User can sign in without malformed callback URLs, token errors, or layout clipping. |
| Logout/login restore | Logout clears the active session; logging back in refreshes access and workspace state. |
| Mobile navigation | Menu opens/closes reliably, active route updates, background does not scroll under drawer, bottom nav remains usable. |
| Inventory search | Search/filter controls are tappable; results do not overflow; empty/no-results states are clear. |
| Card printing selection | Exact printing/condition/finish controls fit on mobile and are reachable with keyboard open. |
| Add/edit inventory | Submit stays reachable, validation messages are visible, writes persist after refresh. |
| Deck Architect | Cards/text remain legible; recommendation surfaces do not become tiny walls of text. |
| Deck Vault/detail | Card images are crisp; card/list/text views are usable; one-card sections do not waste excessive space. |
| Share/export | Share/export actions are visible, named, and do not trigger invalid workflows. |
| CRM create/edit | Form fields use correct keyboard/input types; dialog/drawer scrolls within viewport. |
| Orders workflow | Tables/actions remain usable; disconnected providers are distinct from zero activity. |
| Settings | Data/privacy and account controls are clear; no inert dangerous actions appear as complete automation. |
| Billing | Checkout/portal states are clear; missing provider config shows an actionable unavailable message; no paid access is client-granted. |

## Browser QA Procedure

1. Deploy Preview with safe environment variables.
2. Test public routes unauthenticated at every viewport in the matrix.
3. Configure Playwright QA credentials only through local environment variables: `PLAYWRIGHT_AUTH_EMAIL` / `PLAYWRIGHT_AUTH_PASSWORD` for one representative account, and optional `PLAYWRIGHT_FREE_EMAIL`, `PLAYWRIGHT_COLLECTOR_EMAIL`, `PLAYWRIGHT_SELLER_EMAIL`, `PLAYWRIGHT_STORE_EMAIL`, `PLAYWRIGHT_OWNER_EMAIL` with matching `*_PASSWORD` variables for tier-specific browser QA.
4. Test each representative account type: Free, Collector, Seller, Store, Owner/Admin.
5. For each route, check horizontal overflow, clipped controls, unreadable typography, tiny touch targets, table behavior, overlays, empty/loading/error states, image sharpness, and keyboard/focus.
6. Record failures in this document or the beta QA ledger with severity and fix commit.

## Product/Mobile Readiness Assessment

- Automated public product-shell readiness: GO after this checkpoint.
- Browser-emulated public QA: GO for unauthenticated public/auth route rendering and public header/menu interaction in covered engines.
- Browser-emulated authenticated QA: NO-GO until representative credentials are supplied.
- Physical mobile readiness: NO-GO until iPhone/Android device QA is actually run.
- Overall product/mobile readiness: NO-GO until P0/P1 manual gates above pass or are explicitly accepted as beta limitations.
