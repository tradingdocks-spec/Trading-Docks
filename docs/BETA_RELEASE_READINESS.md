# Trading Docks Beta Release Readiness

Status labels:

- Complete: validated by automated checks or code review in this pass.
- Needs QA: code is wired, but a representative authenticated browser/device walkthrough is still required.
- Blocked: cannot be validated without a real environment, account, credential, device, or external provider.
- Follow-up: not release blocking for closed beta unless reproduced as P0/P1.

## Current Pass

- Branch: `codex/beta-release-readiness-pass`
- Goal: prepare Trading Docks for systematic closed-beta validation without changing pricing, weakening authorization, touching production data, or applying destructive migrations.
- Current release posture: code/static validation is passing; the product must not be called production-ready until the real-account QA matrix below passes.

## Automated Validation Baseline

- Complete: root TypeScript passes with `npm run typecheck`.
- Complete: root unit tests pass with `npm test`.
- Complete: focused dashboard/auth/public UI tests pass.
- Complete: focused lint passes with `npm run lint -- --quiet`.
- Complete: full production build passes with `npm run build`.
- Complete: `git diff --check` passes.
- Complete: `.next/` generated artifacts are not tracked by Git.

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

## Closed-Beta QA Matrix

| Surface | Free | Collector | Seller | Store | Owner/Admin | Required checks |
| --- | --- | --- | --- | --- | --- | --- |
| Public website | Public | Public | Public | Public | Public | Landing, pricing, legal links, signup CTA, mobile layout, SEO metadata, no placeholder copy. |
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
| Billing | RevenueCat web flow | RevenueCat web flow | RevenueCat web flow | RevenueCat web flow | Displays billing truth separately from platform authority | Purchase links, portal links, webhook reconciliation, no client-granted paid access. |
| Mobile app | Auth and Free nav | Collector nav/scanner | Seller nav/actions | Store nav/actions | Additive admin access where supported | Native auth, session restore, scanner, offline queue, safe-area nav, device-only checks. |

## Persistence And Account-Isolation Checks

- Complete: active dashboard shell resolves user access server-side through Supabase-backed platform authority before rendering protected chrome.
- Complete: Card Shows buying drafts now persist through `workspace_documents`; browser storage is used only to migrate and remove the old draft key.
- Complete: Purchasing Intelligence Current Purchase drafts now persist through `workspace_documents`; browser storage is used only to migrate and remove the old session draft key.
- Needs QA: Collection, Deck Vault, Storage, Trade Binder, Wishlist, Purchasing, Orders, CRM, Label Studio, and Admin Catalog must be exercised with two different authenticated accounts to confirm no cross-account reads or writes.
- Needs QA: account-document drafts should be refreshed, signed out, and re-opened in representative workspaces to confirm the intended persistence level is clear to users.
- Follow-up: older `src/components/dashboard-v2` modules still contain browser-storage persistence paths and should be archived or deleted after active import references are fully audited.

## Integration Failure Handling Checks

- Needs QA: RevenueCat web checkout, customer portal, mobile login identity, and webhook reconciliation with real sandbox/test events.
- Needs QA: Supabase Storage-backed TCGplayer catalog import retry/failure states, including failed batch recovery and no duplicate catalog rows.
- Needs QA: TCGTracking provider health, SKU enrichment, pricing fallback, scanner provider failure states, and image fallback behavior.
- Needs QA: marketplace integrations distinguish disconnected channels from true zero activity.
- Needs QA: email delivery templates and redirect URLs for staging/preview and production domains.

## Closed-Beta Severity Gate

- P0: blocks sign-in, routes users to another account's data, grants unauthorized paid/admin access, corrupts data, crashes the app shell, or prevents checkout/webhook reconciliation. No P0 may ship.
- P1: prevents a core promised workflow for its eligible tier, loses user-entered account data unexpectedly, breaks navigation to a visible module, or shows materially false financial/inventory metrics. No open P1 should ship unless explicitly accepted.
- P2: visible polish, empty-state, copy, responsive, or integration error-state defects that do not block the workflow. May ship only with a tracked beta known issue.
- P3: minor copy, spacing, internal documentation, or developer-experience cleanup. May ship with backlog tracking.

## Native And Real-Environment Validation Still Required

- Blocked: physical iOS and Android validation was not run in this web-focused checkpoint.
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
