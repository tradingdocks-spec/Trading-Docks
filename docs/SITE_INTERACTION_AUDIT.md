# Site Interaction Audit

Current branch: `codex/full-site-interaction-polish-audit`  
Audit date: 2026-08-11  
Status: Production-readiness audit with focused interaction fixes and permanent regression coverage.

## Scope

This audit covered the active Next.js application in `src/`, with `src/app` as the route source of truth and the dashboard shell/navigation in `src/components/dashboard`. The active Expo mobile app was inspected only where route contracts overlap with the web navigation model.

Historical snapshots such as backup files and dormant dashboard layout components were not treated as production routes unless imported by the active app.

## Route Inventory

- App route files inspected: 135
- UI pages: 66
- Route handlers: 69
- Next.js production build output: 112 generated app routes
- Critical static hrefs covered by the new route test: 77

### Public Routes

- `/`
- `/pricing`
- `/privacy`
- `/security`
- `/terms`
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/update-password`
- `/onboarding`
- `/collectors/[username]`
- `/collectors/[username]/[binderSlug]`
- `/share/binder/[token]`
- `/share/portfolio/[token]`
- `/q/[token]`

### Dashboard Routes

Implemented and protected by the dashboard layout and route-access registry:

- `/dashboard`
- `/dashboard/inventory`
- `/dashboard/inventory/[cardId]`
- `/dashboard/inventory/bulk-purchases`
- `/dashboard/collector-portfolio`
- `/dashboard/collector-portfolio/binder/[locationId]`
- `/dashboard/deck-vault`
- `/dashboard/deck-vault/new`
- `/dashboard/deck-vault/import`
- `/dashboard/deck-vault/decks/[deckId]`
- `/dashboard/purchasing`
- `/dashboard/card-photo-scanner`
- `/dashboard/collection-buying`
- `/dashboard/sealed-buying`
- `/dashboard/bulk-buying`
- `/dashboard/purchase-history`
- `/dashboard/buying-rules`
- `/dashboard/buying-recommendations`
- `/dashboard/buylist-intelligence`
- `/dashboard/buylist-connections`
- `/dashboard/marketplaces`
- `/dashboard/marketplaces/ebay`
- `/dashboard/orders`
- `/dashboard/sell-optimizer`
- `/dashboard/seller-launch`
- `/dashboard/mission-control-preview`
- `/dashboard/analytics`
- `/dashboard/reports`
- `/dashboard/automation`
- `/dashboard/customers`
- `/dashboard/calendar`
- `/dashboard/tasks`
- `/dashboard/tournaments`
- `/dashboard/vendors`
- `/dashboard/supplies`
- `/dashboard/employees`
- `/dashboard/payroll`
- `/dashboard/label-studio`
- `/dashboard/tools/csv-converter`
- `/dashboard/feedback`
- `/dashboard/settings`
- `/dashboard/plans`
- `/dashboard/billing/success`
- `/dashboard/admin`
- `/dashboard/admin/catalog/tcgplayer`
- `/dashboard/admin/preview`

### API Routes

The production build includes the current admin, billing, catalog, marketplace, collector, deck, order, QR, RevenueCat, and webhook route handlers, including:

- `/api/webhooks/revenuecat`
- `/api/admin/tcgplayer-catalog`
- `/api/label-studio`
- `/api/csv-converter/resolve`
- `/api/collector-workspace/mutations`
- `/api/marketplaces/*`
- `/api/orders/*`

## Access Matrix

The audit confirmed route gates use the shared platform access model:

| Account | Expected Route Surface | Verified |
| --- | --- | --- |
| Free | Dashboard, inventory/collection, plans, settings, public/shared routes | Yes |
| Collector | Free plus collector capabilities such as Deck Vault and analytics-backed collection surfaces | Yes |
| Seller | Seller buying, selling, marketplace, orders, tools, and analytics routes | Yes |
| Store | Seller plus employees, payroll, vendors, supplies, events, CRM, and operations routes | Yes |
| Owner/Admin | Full platform access from trusted `user_roles`, independent of billing tier | Yes |

Client-side spoofing of owner access remains blocked in the regression test.

## Interaction Findings

### Fixed

- Shared dashboard scaffold rendered default CTA-looking buttons with no handler or destination.
  - Fix: actions are now explicit `{ label, href }` links and render only when supplied.
- Shared dashboard scaffold claimed `Updated moments ago` even for empty workspaces.
  - Fix: copy now says `Awaiting first workspace event`.
- Purchasing placeholder empty state used launch-foundation copy.
  - Fix: copy now describes the real empty state and routes users back to Purchasing.
- Purchasing preview copy contained punctuation that was cleaned to ASCII-safe separators.
- Seller Mission Control readiness copy used foundation language.
  - Fix: copy now describes operational workflow improvement.

### Verified

- No placeholder `href="#"`, empty href, or `javascript:` links in the audited active public/dashboard shell surface.
- Account-aware navigation hrefs resolve to real app routes.
- Every concrete dashboard page is classified in the route-access registry.
- Public, auth, dashboard, admin, Label Studio, shared binder, portfolio, and QR routes appear in the route inventory/build output as expected.
- Unauthenticated protected dashboard requests redirect to sign-in with a `next` parameter.
- Invalid public share/QR tokens return a standard 404 without console errors.

## Browser QA

Local production server: `next start` on `127.0.0.1:3013` using safe local public environment placeholders.

Desktop viewport `1440x1000`:

- `/`
- `/pricing`
- `/sign-in`
- `/sign-up`
- `/forgot-password`
- `/privacy`
- `/terms`
- `/security`
- `/dashboard`
- `/dashboard/label-studio`
- `/share/binder/not-a-real-token`
- `/q/not-a-real-token`

Mobile viewport `390x844`:

- `/`
- `/pricing`
- `/sign-in`
- `/sign-up`

Results:

- Console errors: 0 on sampled routes.
- Placeholder hrefs: 0 on sampled routes.
- Horizontal overflow: 0 on sampled routes.
- Protected routes: redirected to sign-in.
- Invalid token routes: returned 404.

## Mobile Compatibility

The active Expo mobile route group still registers five tabs in `mobile/app/(tabs)/_layout.tsx`:

- Home
- Collection
- Scan
- Intelligence/Decks route slot through `sell`
- Account

`mobile/app/deal-desk.tsx` is outside the `(tabs)` group, so it is not registered as a sixth bottom tab. This audit did not modify mobile navigation.

## Remaining Production Risks

- Dormant and duplicate dashboard implementations remain in the repository, including `src/components/dashboard/layout/*`, `src/components/dashboard-v2/*`, and `src/app/page-current-backup.tsx`. They are not active route owners, but they still increase code-search noise and should be archived or removed in a dedicated cleanup branch after import verification.
- Authenticated role/browser QA still needs real seeded staging accounts for each role. Static route-access tests now cover the matrix, but visual QA for each authenticated dashboard variant requires test users.
- Shared public token routes correctly 404 for invalid tokens; valid-token rendering should be verified with seeded staging share/QR records before production launch.
- Admin feature-category controls intentionally include a `coming soon` visibility state. That is product-state copy, not a broken route marker.

## Regression Coverage Added

`tests/site-interaction-audit.test.ts` now verifies:

- Active app route inventory contains critical public, protected, shared, admin, API, and webhook routes.
- Account-aware dashboard navigation links resolve to real app routes.
- Static public/dashboard shell links avoid placeholder hrefs and resolve to real routes.
- Role-gated route behavior preserves Free, Collector, Seller, Store, Owner/Admin, and client-spoofing boundaries.
- Every concrete dashboard page is classified in `ROUTE_ACCESS_REGISTRY`.
- Shared scaffold surfaces do not render fake action buttons.

## Validation

- `npm test`: Passed
- `npm run typecheck`: Passed
- `npm run lint -- --quiet`: Passed
- `npm run build`: Passed
- Browser smoke QA: Passed on sampled desktop and mobile routes

