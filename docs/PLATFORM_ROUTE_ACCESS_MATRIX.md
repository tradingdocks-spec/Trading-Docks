# Platform Route Access Matrix

Status: Partially Implemented

This matrix records current route intent and access expectations. It does not guarantee that every route has complete feature implementation.

## Public Web Routes

| Route | Required auth | Status | Notes |
| --- | --- | --- | --- |
| `/` | No | Implemented | Public marketing/home surface. |
| `/sign-in` | No | Implemented | Auth entry. Signed-in users redirect away. |
| `/sign-up` | No | Implemented | Auth entry. |
| `/forgot-password` | No | Implemented | Auth recovery. |
| `/update-password` | Session/recovery context | Partially Implemented | Depends on Supabase auth state. |
| `/pricing` | No | Implemented | Must stay aligned with canonical catalog. |
| `/privacy`, `/terms`, `/security` | No | Implemented | Legal/security pages. |
| `/share/binder/[token]`, `/share/portfolio/[token]` | Token | Partially Implemented | Share routes should not expose private owner data beyond token scope. |

## Web Dashboard Routes

| Route family | Minimum membership | Account/workspace | Status | Notes |
| --- | --- | --- | --- | --- |
| `/dashboard` | Free | Any | Implemented | Protected dashboard entry. |
| `/dashboard/inventory` | Free | Any | Partially Implemented | Canonical collection/inventory surface. |
| `/dashboard/deck-vault` | Free | Collector+ | Partially Implemented | Free has deck limits. |
| `/dashboard/collector-portfolio` | Collector | Collector+ | Partially Implemented | Value/portfolio features require Collector. |
| `/dashboard/purchasing` | Seller | Seller/Store | Partially Implemented | Deal Desk route family. |
| `/dashboard/collection-buying` | Seller | Seller/Store | Partially Implemented | Buying workflow. |
| `/dashboard/sealed-buying` | Seller | Seller/Store | Partially Implemented | Buying workflow. |
| `/dashboard/bulk-buying` | Seller | Seller/Store | Partially Implemented | Buying workflow. |
| `/dashboard/purchase-history` | Seller | Seller/Store | Partially Implemented | Buying workflow. |
| `/dashboard/buying-rules` | Seller | Seller/Store | Partially Implemented | Buying workflow. |
| `/dashboard/card-shows` | Seller | Seller/Store | Partially Implemented | Seller tools. |
| `/dashboard/marketplaces` | Seller | Seller/Store | Partially Implemented | Seller tools. |
| `/dashboard/orders` | Seller | Seller/Store | Partially Implemented | Seller tools. |
| `/dashboard/analytics` | Seller | Seller/Store | Partially Implemented | Seller/Store analytics. |
| `/dashboard/employees` | Store | Store | Partially Implemented | Store operations. Employee limits remain pending configuration. |
| `/dashboard/customers` | Store | Store | Partially Implemented | Store operations. |
| `/dashboard/organization` | Store | Store | Partially Implemented | Store operations. |
| `/dashboard/settings` | Free | Any | Implemented | Protected settings. |
| `/dashboard/admin` | Role: owner/admin | Any | Partially Implemented | Admin is additive and must not replace normal workspace. |

## Mobile Routes

| Account composition | Visible primary tabs | Status | Notes |
| --- | --- | --- | --- |
| Free | Home, Collection, Scan, Signals, Profile | Implemented | Exactly five tabs. |
| Collector | Home, Collection, Scan, Signals, Profile | Implemented | Exactly five tabs. |
| Seller | Home, Collection, Deal Desk, Signals, Profile | Implemented | Exactly five tabs. |
| Store | Home, Business, Deal Desk, Activity, Profile | Implemented | Exactly five tabs. Business label maps to collection route. |
| Owner/Admin | Normal workspace plus Command Center entry | Partially Implemented | Admin entry is additive. |

## Protection Rules

Status: Partially Implemented

- Route guards must wait for session restoration before evaluating protected destinations.
- Browser refresh and deep links should resolve through the same server/client authority path.
- UI hiding is not authorization. Backend checks remain required for privileged data and mutations.
- Missing account type should fall back to a safe workspace route, not an admin-only or paid-only route.

## Route Registry Implementation

Status: Partially Implemented

`src/lib/platform/route-access.ts` now defines a typed representative route registry. Initial covered routes include public/auth routes, dashboard, inventory/collection, orders, analytics, CRM, employees, settings, admin, and development-only design-system access.

Unmapped dashboard routes currently fail closed to a store-level protected bucket in the registry until each route is explicitly classified.

## Route Protection Gaps

| Gap | Severity | Notes |
| --- | --- | --- |
| Some web dashboard route families are older product surfaces with overlapping responsibilities. | P1 | Consolidate behind a route registry before broader redesign. |
| Admin sub-navigation collapses many destinations to `/dashboard/admin`. | P2 | Safe, but not a complete route map for future Command Center work. |
| Share routes need continued review for token scoping and no-store/noindex behavior. | P1 | Public token routes are sensitive. |
