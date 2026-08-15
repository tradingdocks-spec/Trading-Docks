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
- Complete: focused dashboard/auth/public UI tests pass.
- Complete: focused lint passes for changed dashboard and auth files.
- Complete: full production build passed after the latest production-readiness slice.

## Fixes Completed

- Complete: generic dashboard scaffold empty states no longer imply live data before the workspace records activity.
- Complete: generic dashboard scaffold no longer renders decorative fake progress bars for zero-data routes.
- Complete: Automation route now renders a complete beta empty state with clear operational entry points instead of a header-only workspace.
- Complete: Customer CRM empty state no longer exposes an inactive CSV import CTA.
- Complete: Mission Control Preview is removed from production navigation and the direct route redirects to the dashboard instead of showing hard-coded preview metrics.
- Complete: shared dashboard page headers render primary action buttons only when a real handler is wired.
- Complete: Tasks, Reports, Vendors, Supplies, and Payroll no longer display non-functional primary actions.
- Complete: Tasks, Vendors, and Supplies use direct empty states instead of hidden empty-array template loops.
- Complete: auth redirect origin construction is normalized so scheme-bearing forwarded hosts cannot produce malformed `https://https://...` callback URLs.
- Complete: Store/Owner dashboard navigation no longer repeats the same route in multiple sidebar sections.
- Complete: trusted Admin navigation now uses the same full-platform access authority as Owner instead of hiding Seller/Store tools behind the raw billing tier.
- Complete: Analytics now composes Owner/Admin views from trusted platform authority instead of raw billing tier, while preserving the displayed commercial membership.
- Complete: Analytics inventory aging uses real row timestamps for recent inventory and no longer renders broken encoded separators.

## Product Surface Checklist

- Needs QA: public landing, pricing, sign-in, sign-up, password reset, and onboarding flows.
- Needs QA: dashboard navigation and role-aware route visibility across Free, Collector, Seller, Store, Owner, and Admin accounts.
- Complete: generic operational dashboard pages now avoid fake charts, fake activity, dead primary actions, and hidden template rows in the active Store/Owner surfaces reviewed in this pass.
- Complete: automated route/navigation tests now assert account-aware navigation does not duplicate route entries, trusted Admin sees the full operational surface, and analytics Owner/Admin access does not regress to a Free-style composition.
- Needs QA: generic operational dashboard pages still need browser walkthroughs with real Store/Owner workspaces and representative empty/non-empty data.
- Needs QA: Collection, Storage, Trade Binder, Wishlist, and inventory persistence with representative user-owned data.
- Needs QA: Deck Vault import, deck detail, card preview, and Supabase persistence.
- Needs QA: Purchasing Intelligence, Image Lookup, Collection Buying, Sealed Buying, Precon, Bulk Buying, and Purchase History.
- Needs QA: Orders, Inventory, Analytics, CRM, Card Shows, Label Studio, Admin Catalog, Settings, and membership gates.
- Needs QA: mobile layouts, scanner flows, navigation, native auth/session restoration, and offline states.

## Known Follow-up Items

- Follow-up: older `src/components/dashboard-v2` modules still contain browser-storage persistence paths and should be retired or formally archived once active imports are fully audited.
- Follow-up: browser QA needs representative authenticated accounts for Free, Collector, Seller, Store, Owner, and Admin to verify role-aware dashboards and route access end to end.
- Follow-up: Playwright is referenced in the lockfile but `node_modules/@playwright/test` is not installed locally in this workspace, so automated browser walkthroughs were not run in this pass.
- Follow-up: production/staging Supabase verification should be run with non-production customer data only; do not copy production auth, inventory, or billing data into staging.
