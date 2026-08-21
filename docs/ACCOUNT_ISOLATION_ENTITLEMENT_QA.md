# Account Isolation And Entitlement QA

This document is the representative-account QA plan for the Production Launch Program.

Status labels:

- Automated: covered by repository tests in this checkpoint.
- Source-reviewed: checked by static route/API/source review in this checkpoint.
- Manual required: requires real deployed accounts, Supabase data, and browser/API sessions.
- Blocked: cannot be truthfully completed from the local repository alone.

## Representative Account Scenarios

| Scenario | Account shape | Workspace shape | Automated coverage | Manual proof still required |
| --- | --- | --- | --- | --- |
| New Free account | Authenticated normal user, Free membership, no trusted platform role | Own workspace/member | Route/API capability matrix for Free restrictions | Browser sign-up/sign-in, upgrade prompts, Free collection limits, direct URL denial for Seller/Store/Admin routes. |
| Collector account | Normal user, Collector membership | Own workspace/member | Collector access to Deck Vault, Binder, Analytics, CSV; denial for Seller/Store/Admin | Real collection/deck/binder CRUD and persistence after refresh. |
| Seller account | Normal user, Seller membership | Own workspace/member or manager | Seller route/API access to buying, orders, marketplaces, Label Studio view/print where role allows | Marketplace/order/import write isolation and disconnected-provider states. |
| Store account | Normal user, Store membership | Own workspace manager/admin/owner | Store access to employee, vendor, supplies, events, finances based on workspace role | Store operations CRUD and workspace-member role checks in browser. |
| Owner/Admin account | Trusted `user_roles.owner` or `user_roles.admin`, commercial plan may remain Free | Normal workspace plus platform admin authority | Trusted Owner/Admin full platform route/capability access; client-spoofed Owner denied | Admin route browser walkthrough and audit of no accidental customer-data mutation. |
| User A / User B | Two unrelated normal users | Separate workspaces | Source-level user/workspace filters for reviewed high-risk APIs | Attempt direct object-ID access across inventory, decks, orders, customers, settings, imports, Label Studio, and analytics. |

## Entitlement Matrix

The implementation source of truth is `mobile/services/platform-access.ts`, consumed by web through `src/lib/platform/*`.

| Feature area | Free | Collector | Seller | Store | Trusted Owner/Admin |
| --- | --- | --- | --- | --- | --- |
| Dashboard shell, settings, billing surfaces | Yes | Yes | Yes | Yes | Yes |
| Collection read/write | Yes, with Free limits | Yes | Yes | Yes | Yes |
| Deck Vault / Deck Architect | Yes | Yes | Yes | Yes | Yes |
| Scanner use | Yes | Yes | Yes | Yes | Yes |
| Advanced scanner | No | Yes | Yes | Yes | Yes |
| Trade Binder / Wishlist | No | Yes | Yes | Yes | Yes |
| Collector analytics / Portfolio | No | Yes | Yes | Yes | Yes |
| CSV export/conversion | No | Yes | Yes | Yes | Yes |
| Purchasing / Deal Desk / Buylist workflows | No | No | Yes | Yes | Yes |
| Orders / Marketplace management | No | No | Yes | Yes | Yes |
| Label Studio view | No | No | Yes | Yes | Yes |
| Label printing | No | No | Seller + workspace member | Store + workspace member | Yes |
| Label templates / repricing | No | No | Seller + workspace manager | Store + workspace manager | Yes |
| CRM / customers | No | No | Yes | Yes | Yes |
| Employees / vendors / supplies / events / finances | No | No | Limited by capability | Yes, workspace-role gated | Yes |
| Payroll / workspace administration | No | No | No | Store + workspace admin/owner | Yes |
| Platform Command Center / admin APIs | No | No | No | No | Trusted platform role only |

Important distinction:

- Billing membership is commercial state.
- Platform role is trusted authority from `user_roles`.
- Effective access is resolved centrally. Trusted Owner/Admin receives full platform capabilities without being converted to a fake paid subscription.
- Client-provided role state is not trusted for Owner/Admin elevation.

## Server Boundary Review

Automated/source-reviewed in this checkpoint:

- Every concrete `/api/*` route is classified by `API_ACCESS_REGISTRY`; no route falls through to the unclassified server-only fallback.
- Every concrete `/dashboard/*` page is classified by `ROUTE_ACCESS_REGISTRY`; unclassified dashboard routes remain blocked by default.
- `/api/scanner/tcgtracking` now resolves the authenticated actor into canonical platform access and enforces `scanner.use`, so suspended accounts cannot call the scanner provider by direct POST.
- `/api/binder-shares` now requires `binder.manage`, so a Free account cannot create or revoke Trade Binder shares by direct POST/DELETE while the UI is hidden.
- Binder-share payload creation still verifies every requested inventory record with `.eq("user_id", userId)` before using service-role insertion for the public share record.
- Binder-share revocation still scopes by `.eq("owner_id", user.id)` and token.
- Label Studio API scopes templates, identities, repricing, and inventory rows to the resolved workspace ID.
- Marketplace/order fulfillment routes reviewed in this pass consistently use current-user or active-workspace filters before mutating user-owned data.

## Manual Multi-User IDOR Procedure

Use a safe staging/preview Supabase project with no production customer data.

1. Create User A and User B through normal auth.
2. Give each user a separate active workspace.
3. Create distinct records for User A:
   - inventory item
   - deck
   - marketplace/order row
   - customer
   - import/job row where available
   - Label Studio template/identity if Seller+ capability is present
4. Sign in as User B.
5. Try direct URL/API access using User A IDs:
   - `/dashboard/inventory/[cardId]`
   - Deck Vault detail URLs
   - order fulfillment/reconciliation APIs
   - customer/CRM screens
   - Label Studio API payloads containing User A item/template IDs
   - binder share creation using User A inventory IDs
6. Expected result: User B receives 401/403/404 or an empty workspace-scoped result, never User A data.
7. Repeat the inverse direction from User A to User B.
8. Repeat with Owner/Admin only after confirming the action is expected platform administration, not normal workspace impersonation.

## Launch Assessment For Account Isolation

- Automated account entitlement coverage: GO for route/API catalog classification and shared capability resolution.
- Direct API hardening: GO for scanner provider and binder-share mutation after this checkpoint.
- End-to-end account isolation: NO-GO until representative User A/User B browser/API tests are run against a safe deployed Supabase environment.
- Production data safety: GO for this checkpoint; no production database changes were made or required.
