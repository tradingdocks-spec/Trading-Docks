# Platform Access Model

Status: Partially Implemented

Trading Docks now has a typed platform access contract that separates identity, role, account type, membership, workspace authority, and capabilities.

## Canonical Context

Status: Implemented

`PlatformAccessContext` is defined in `mobile/services/platform-access.ts` and used by web adapters and server guards.

| Field | Meaning |
| --- | --- |
| `userId` | Supabase Auth user id, or `null` for unauthenticated callers. |
| `authenticated` | Whether the caller has a restored authenticated session. |
| `platformRole` | `owner`, `admin`, `support`, `analyst`, or `user` from `user_roles`. |
| `accountType` | `free`, `collector`, `seller`, or `store`; legacy `business` normalizes to `store`. |
| `membershipTier` | Effective membership tier after billing/manual override resolution. |
| `billingStatus` | Current canonical billing status. |
| `entitlements` | Resolved entitlement keys from the membership catalog plus explicit admin command-center access. |
| `workspaceId` | Active workspace id when available. |
| `workspaceRole` | `owner`, `admin`, `manager`, `member`, `viewer`, or `null`. |
| `providerState` | Server-side provider source hint: `stripe`, `revenuecat`, `manual`, `mixed`, `none`, or `unknown`. |
| `suspended` | Whether the user/account is blocked from capabilities. |
| `warnings` | Non-authoritative diagnostics for missing role, account type, membership, stale billing, or suspension. |

## Capability Registry

Status: Implemented for representative coverage

Capabilities describe actions, not pages. Current registry includes collection, scanner, binder, wishlist, inventory, buying, orders, marketplaces, analytics, automation, CSV export, CRM, employees, payroll, vendors, supplies, business intelligence, workspace management, billing, and platform admin.

## Authority Rules

Status: Implemented

- `membershipTier = store` does not imply `platformRole = admin`.
- `workspaceRole = manager` does not imply `membershipTier = store`.
- `platformRole = admin` does not replace the user's normal workspace/account identity.
- Client-safe access is only for navigation, display, and upgrade prompts.
- Server routes, API routes, and future RLS/RPC policies remain authoritative.

## Initial Migration Proof

Status: Partially Implemented

Active web route and API authorization now consume the model:

- Dashboard shell passes a client-safe access snapshot.
- Sidebar and plan gate use route/capability access instead of direct plan-feature checks.
- `/dashboard/admin` uses the reusable server route guard.
- `/api/csv-converter/resolve` uses the API capability guard for `csv.export`.
- `/api/orders/reconciliation` uses the API capability guard for `orders.manage`.
- Active dashboard page routes are explicitly classified by `src/lib/platform/route-access.ts`; unknown dashboard paths fail closed.
- Active `src/app/api` route handlers are classified by `src/lib/platform/api-access.ts`; user-facing protected routes migrate to `requireApiCapability`.

## Remaining Work

Status: Planned

- Add route-handler integration fixtures for standard `401` unauthenticated and `403` unauthorized API responses.
- Continue retiring legacy display/helper modules once imports are audited.
- Expand workspace-owned data authorization before broader Store/team workflows.
- Replace historical email-based SQL owner helpers with `user_roles` SQL helpers.
