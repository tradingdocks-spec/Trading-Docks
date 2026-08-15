# Trading Docks Beta Release Readiness

Status labels:

- Complete: validated in this pass.
- In Progress: actively being audited or improved.
- Needs QA: code appears wired, but representative browser/device/account testing is still required.
- Follow-up: known work that should be scheduled separately.

## Current Pass

- Branch: `codex/beta-release-readiness-pass`
- Goal: bring the active web and mobile product surfaces toward a respectable beta/release-candidate state without changing pricing, weakening authorization, touching production data, or applying destructive migrations.

## Validation Baseline

- Complete: root TypeScript passes with `npm run typecheck`.
- Complete: root unit tests pass with `npm test`.
- Complete: focused dashboard scaffold lint passes.
- Complete: focused public/dashboard UI tests pass.
- In Progress: full production build and final repository-wide validation after this pass.

## Fixes Completed

- Complete: generic dashboard scaffold empty states no longer imply live data before the workspace records activity.
- Complete: generic dashboard scaffold no longer renders decorative fake progress bars for zero-data routes.
- Complete: Automation route now renders a complete beta empty state with clear operational entry points instead of a header-only workspace.

## Product Surface Checklist

- Needs QA: public landing, pricing, sign-in, sign-up, password reset, and onboarding flows.
- Needs QA: dashboard navigation and role-aware route visibility across Free, Collector, Seller, Store, Owner, and Admin accounts.
- In Progress: generic operational dashboard pages and shared empty/error/loading states.
- Needs QA: Collection, Storage, Trade Binder, Wishlist, and inventory persistence with representative user-owned data.
- Needs QA: Deck Vault import, deck detail, card preview, and Supabase persistence.
- Needs QA: Purchasing Intelligence, Image Lookup, Collection Buying, Sealed Buying, Precon, Bulk Buying, and Purchase History.
- Needs QA: Orders, Inventory, Analytics, CRM, Card Shows, Label Studio, Admin Catalog, Settings, and membership gates.
- Needs QA: mobile layouts, scanner flows, navigation, native auth/session restoration, and offline states.

## Known Follow-up Items

- Follow-up: older `src/components/dashboard-v2` modules still contain browser-storage persistence paths and should be retired or formally archived once active imports are fully audited.
- Follow-up: browser QA needs representative authenticated accounts for Free, Collector, Seller, Store, Owner, and Admin to verify role-aware dashboards and route access end to end.
- Follow-up: production/staging Supabase verification should be run with non-production customer data only; do not copy production auth, inventory, or billing data into staging.
