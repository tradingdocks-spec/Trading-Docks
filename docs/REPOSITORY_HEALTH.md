# Repository Health

## Technical Debt

- Partially Implemented: Multiple dashboard systems coexist in `src/components/dashboard`, `src/components/dashboard-v2`, and older layout folders.
- Partially Implemented: Large historical release notes and backup mobile directories remain in the root.
- Partially Implemented: `node_modules-install-failed` appears in the repository tree and should not be part of product source.
- Partially Implemented: Root README still references an old binder removal release instead of the current OS foundation.
- Partially Implemented: Repository-wide lint currently fails with 67 errors and 414 warnings. These failures predate this documentation branch, and backup/archive directories contribute heavily to the failure count.
- Planned: Lint remediation should be handled in a dedicated stabilization task, not mixed into this documentation-only foundation branch.

## Authentication Problems

- Implemented: Active web and mobile admin access now use `user_roles` as the platform-role authority.
- Implemented: Active web code no longer authorizes admin access from a hard-coded owner email.
- Partially Implemented: Legacy Supabase migrations still contain email-based `is_platform_owner()` functions and policies.
- Implemented: Mobile email/password auth now renders exact Supabase errors, persists remembered-email preferences only when selected, restores sessions before route guards render, and exposes Command Center as an additive protected destination when role lookup succeeds.
- Partially Implemented: Native biometric/session-lock scaffolding remains architecture-only until verified on physical iOS/Android devices.
- Requires Production Configuration: Supabase Auth settings, OAuth callbacks, recovery flow settings, and MFA are not provable from source.

## Navigation Issues

- Implemented: Active mobile tabs now use `mobile/services/navigation-contract.ts` for account-aware labels, hidden routes, prominent tab selection, selected state, and fallback account behavior.
- Implemented: Active web dashboard navigation now uses `src/lib/navigation/contract.ts` and `src/components/dashboard/navigation.ts` for account-aware labels in `TieredDashboardShell` and mobile web bottom nav.
- Implemented: Admin navigation is additive: normal workspaces remain the default, and Command Center stays protected by route guards.
- Partially Implemented: Multiple older navigation definitions still exist in dashboard legacy folders and backup snapshots.
- Partially Implemented: Some canonical labels map to existing workspace shells because dedicated route content is not implemented yet.
- Partially Implemented: Web admin subnavigation is represented by the current Command Center surface rather than dedicated pages for every admin destination.

## Component Duplication

- Partially Implemented: Dashboard shells, topbars, sidebars, workspace frames, metric cards, inventory workspaces, purchasing workspaces, deck vault components, and business operation components have overlapping versions.
- Partially Implemented: Web and mobile now have first-wave TD primitives, but legacy `src/components/ui`, mobile `foundation.tsx`, mobile `primitives.tsx`, `mobile/constants/brand.ts`, and many screen-local style systems still coexist.
- Implemented: Shared semantic tokens and first-wave TD primitives provide a canonical migration target for buttons, cards, inputs, badges, text, screen shells, section headers, loading states, empty states, error states, and dividers.
- Planned: Pick a canonical component tree and archive or delete superseded versions after review.

## Potential Bugs

- Partially Implemented: Web and mobile membership tiers/prices diverge.
- Partially Implemented: Mobile `store` tier and web `business` tier can drift.
- Partially Implemented: Some API allowlisted endpoints may expose expensive external calls without durable rate limiting.
- Partially Implemented: Multiple migration repair files may not replay cleanly in a fresh database without manual sequencing review.

## Security Concerns

- Requires Production Configuration: Rotate any secrets that were ever committed or pasted outside secure stores.
- Requires Production Configuration: Validate Stripe, Supabase, Cloudflare, Resend, Vercel, and marketplace settings in staging.
- Partially Implemented: Cross-account isolation is documented but not automated in CI.
- Planned: Add durable rate limiting and observability.

## Architecture Improvements

- Planned: Establish canonical web dashboard architecture.
- Planned: Establish a shared membership contract for web, mobile, billing, and marketing.
- Implemented: Shared identity/access types now separate platform role, account type, membership tier, billing status, and entitlements.
- Planned: Generate a canonical Supabase schema snapshot from a clean migration replay.
- Planned: Move historical release notes/backups out of active source or clearly archive them.
- Planned: Continue incremental design-system migration rather than sweeping every screen into the new primitives at once.
- Planned: Deprecate duplicated dashboard navigation modules only after active imports are audited and route content gaps are prioritized.

## Performance Opportunities

- Planned: Audit large client components for bundle size and split heavy dashboard workspaces.
- Planned: Cache safe public card data with explicit provider limits and invalidation rules.
- Planned: Replace duplicate component systems with shared primitives to reduce CSS/runtime weight.
- Planned: Use shared loading, empty, and error states to reduce repeated rendering logic and bespoke animation code.

## Missing Tests

- Implemented: Focused mobile auth tests cover email/password success and failure, session restoration, admin routing, normal routing, remembered email, and keep-me-signed-in discard behavior.
- Implemented: Focused mobile design-system tests cover token exports, semantic colors, button disabled/loading behavior, input error state, and accessibility metadata.
- Implemented: Focused mobile navigation/auth contract tests cover protected-route loading, Collector/Seller/Store tab labels, admin route access, normal-user admin denial, fallback account type, and selected tab state.
- Implemented: Focused identity/access tests cover owner, admin, support, analyst, normal user, missing role, suspended account, admin with Free membership, Seller without admin role, and authorized/unauthorized web admin route decisions.
- Planned: Auth redirect and callback tests.
- Planned: Plan access and route entitlement tests.
- Planned: Billing webhook tests with signature and idempotency cases.
- Planned: Public share token validation tests.
- Planned: API route authentication allowlist tests.
- Planned: Supabase RLS/cross-account isolation tests.
- Planned: Mobile auth/session/offline queue tests.
- Planned: Native device tests for biometric unlock and OAuth/magic-link callback handling.

## Documentation Gaps

- Partially Implemented: Historical docs exist as release notes, not durable architecture docs.
- Partially Implemented: Mobile README is still mostly default Expo text.
- Implemented: `docs/DESIGN_SYSTEM.md` now records the current design-system source of truth, audit findings, token naming, component usage, migration strategy, web/native differences, deprecated patterns, and remaining design-system debt.
- Planned: Add a canonical environment variable matrix.
- Planned: Add provider setup runbooks for Stripe, Supabase, Cloudflare, eBay, Mana Pool, Resend, Vercel, and mobile app store builds.

## Recommended Sprint 1

1. Freeze new product features until architecture and membership contracts are reviewed.
2. Continue from the new canonical navigation contracts by auditing legacy dashboard imports and deciding which old navigation modules can be retired.
3. Align web/mobile membership tier names, prices, limits, and source of truth.
4. Audit API authentication and entitlement enforcement endpoint by endpoint.
5. Replay Supabase migrations in a fresh staging project and record the canonical schema.
6. Add CI coverage for auth, plan gates, billing webhooks, public share safety, and API allowlists.
7. Remove or archive dependency/build backup artifacts after a separate review-approved cleanup.
8. Continue design-system migration through shared dashboard states and common cards before attempting modal primitives.

## Recommended Identity Sprint 1

1. Draft and review a Supabase migration that replaces `is_platform_owner()` policies/functions with `user_roles`/`is_admin()`.
2. Replay migrations in staging to confirm `user_roles`, `admin_audit_log`, `admin_membership_overrides`, and billing tables converge cleanly.
3. Decide whether `business` and `store` should become one enum value across web, mobile, and database rows.
4. Add route-handler tests for privileged admin API permissions once a Next route test harness is configured.

## Recommended Navigation Sprint 1

1. Verify route content for labels marked Partially Implemented, especially mobile Seller Buying, mobile Store Business/Activity, web Trade Binder, web Deal Desk, and web admin subareas.
2. Verify web and mobile admin navigation after the shared `user_roles` authority change.
3. Add server-side entitlement tests for dashboard routes so hidden navigation never becomes the only access control.
4. Retire unused sidebars and navigation definition files after confirming no active imports.
