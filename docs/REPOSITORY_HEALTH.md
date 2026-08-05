# Repository Health

## Technical Debt

- Partially Implemented: Multiple dashboard systems coexist in `src/components/dashboard`, `src/components/dashboard-v2`, and older layout folders.
- Partially Implemented: Large historical release notes and backup mobile directories remain in the root.
- Partially Implemented: `node_modules-install-failed` appears in the repository tree and should not be part of product source.
- Implemented: Root README now identifies `src/` as the active web app, `mobile/` as the active Expo app, and `supabase/` as active database infrastructure.
- Implemented: Root ESLint now excludes confirmed backup/archive folders and generated output from active lint traversal.
- Partially Implemented: Repository-wide lint was previously recorded as failing with 67 errors and 414 warnings. These failures predate this repository stabilization branch, and backup/archive directories contributed heavily to the failure count before the safe exclusions.
- Planned: Remaining lint remediation should be handled in a dedicated stabilization task and should not be mixed with Collector Workspace product work.

## Authentication Problems

- Implemented: Active web and mobile admin access now use `user_roles` as the platform-role authority.
- Implemented: Active web code no longer authorizes admin access from a hard-coded owner email.
- Partially Implemented: Legacy Supabase migrations still contain email-based `is_platform_owner()` functions and policies.
- Implemented: Mobile email/password auth now renders exact Supabase errors, persists remembered-email preferences only when selected, restores sessions before route guards render, and exposes Command Center as an additive protected destination when role lookup succeeds.
- Partially Implemented: Native biometric/session-lock scaffolding remains architecture-only until verified on physical iOS/Android devices.
- Requires Production Configuration: Supabase Auth settings, OAuth callbacks, recovery flow settings, and MFA are not provable from source.

## Navigation Issues

- Implemented: Active mobile tabs now use `mobile/services/navigation-contract.ts` for account-aware labels, hidden routes, prominent tab selection, selected state, and fallback account behavior.
- Implemented: Active mobile tabs now render as one compact bottom navigation bar with exactly five visible tabs per account, consistent Ionicons, safe-area-aware height, and no Explore placeholder route in the active tab group.
- Implemented: Mobile Home now preserves the bottom tab bar as the only primary navigation system; the Home action row is a compact deep-link surface, not a duplicate persistent nav.
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

- Implemented: Active web and mobile membership tier names, prices, limits, and plan-card labels now use the canonical `free | collector | seller | store` catalog.
- Implemented: Authenticated collection surfaces no longer present static sample cards as live user data.
- Implemented: Mobile Home no longer presents mock collection value, mock movement, mock signals, or fake recent activity as live user data.
- Implemented: Collector card detail surfaces now support organization actions with optimistic updates and rollback rather than showing read-only planned action cards.
- Partially Implemented: Web `/dashboard/inventory` now uses the Collector Workspace browser; older inventory management components remain in source and need workflow review before retirement.
- Implemented: A forward-only Collector mutation security migration proposal now exists for DB-side ownership and Free-plan total-quantity enforcement, but it is not applied to production.
- Partially Implemented: Native direct Collector writes still need the proposed DB migration applied and replay-verified before production reliance; current web writes enforce the limit through the Next.js mutation API.
- Partially Implemented: Collection price display depends on positive saved inventory value fields and shows unavailable when those fields are missing or defaulted to zero.
- Requires Production Configuration: Supabase billing, trial, override, and feature-access schema constraints still need a reviewed migration from legacy `business` to canonical `store`.
- Partially Implemented: Some API allowlisted endpoints may expose expensive external calls without durable rate limiting.
- Partially Implemented: Multiple migration repair files may not replay cleanly in a fresh database without manual sequencing review.

## Security Concerns

- Requires Production Configuration: Rotate any secrets that were ever committed or pasted outside secure stores.
- Requires Production Configuration: Validate Stripe, Supabase, Cloudflare, Resend, Vercel, and marketplace settings in staging.
- Partially Implemented: Cross-account isolation is documented but not automated in CI.
- Planned: Add durable rate limiting and observability.

## Architecture Improvements

- Planned: Establish canonical web dashboard architecture.
- Implemented: Establish a shared membership contract for web, mobile, admin, Stripe adapter code, and future RevenueCat adapter planning.
- Implemented: Shared identity/access types now separate platform role, account type, membership tier, billing status, and entitlements.
- Planned: Generate a canonical Supabase schema snapshot from a clean migration replay.
- Partially Implemented: `docs/REPOSITORY_CLEANUP_PLAN.md` now inventories historical backups, generated output, duplicate dashboard systems, duplicate navigation, duplicate design-system layers, unused candidates, and cleanup phases.
- Planned: Move historical release notes/backups out of active source after product-owner review.
- Planned: Continue incremental design-system migration rather than sweeping every screen into the new primitives at once.
- Planned: Deprecate duplicated dashboard navigation modules only after active imports are audited and route content gaps are prioritized.

## Performance Opportunities

- Implemented: Collector Workspace search is debounced, mobile rendering uses `FlatList`, and data loaders cap reads with `COLLECTION_PAGE_SIZE`.
- Planned: Add cursor-based pagination and server-side filter endpoints for large collections.
- Planned: Audit large client components for bundle size and split heavy dashboard workspaces.
- Planned: Cache safe public card data with explicit provider limits and invalidation rules.
- Planned: Replace duplicate component systems with shared primitives to reduce CSS/runtime weight.
- Planned: Use shared loading, empty, and error states to reduce repeated rendering logic and bespoke animation code.

## Missing Tests

- Implemented: Focused mobile auth tests cover email/password success and failure, session restoration, admin routing, normal routing, remembered email, and keep-me-signed-in discard behavior.
- Implemented: Focused mobile design-system tests cover token exports, semantic colors, button disabled/loading behavior, input error state, and accessibility metadata.
- Implemented: Focused mobile navigation/auth contract tests cover protected-route loading, Collector/Seller/Store tab labels, five-tab composition, no Explore placeholder tab, center-action reachability, safe-area sizing, admin route access, normal-user admin denial, fallback account type, and selected tab state.
- Implemented: Focused identity/access tests cover owner, admin, support, analyst, normal user, missing role, suspended account, admin with Free membership, Seller without admin role, and authorized/unauthorized web admin route decisions.
- Planned: Auth redirect and callback tests.
- Implemented: Focused membership entitlement tests cover prices, annual savings, limits, financial access, Deal Desk access, web workspace access, Store employee entitlement, role separation, billing fallback, and unknown-tier fallback.
- Implemented: Focused Collector Workspace tests cover search filtering, sorting, exact-printing display, storage-location display, trade-binder indicator, wishlist indicator, Free card-limit behavior, empty state, no-results state, and safe missing-price behavior.
- Implemented: Focused Collector mutation tests cover ownership rejection, Free-plan limits, quantity validation, condition/finish/storage/trade/wishlist optimistic updates, rollback, trade-filter visibility, user-isolated offline queue entries, and duplicate queued-write prevention.
- Implemented: Collector mutation tests now cover recognition of proposed database-authoritative ownership and Free-limit errors for offline replay.
- Implemented: Collector Workspace tests now cover cursor construction, end-of-results state, duplicate page merging, search/filter/sort reset keys, stale response rejection, and exact-printing preservation.
- Implemented: Focused Storage Location Manager tests cover create payloads, hierarchy paths, search, cards-in-location, unassigned cards, archive-with-assigned-card rejection, cross-user rejection, recent/favorite ordering, assignment validation, missing-location fallback, invalid parent relationships, and offline assignment dedupe keys.
- Implemented: Focused Trade Binder/Wishlist tests cover binder search/filters, status updates, wishlist add/remove semantics, priority updates, exact/flexible matches, condition/finish mismatch rejection, quantity handling, storage search, optimistic rollback data, offline de-dupe keys, user isolation, empty state, and no-results state.
- Implemented: Focused mobile Home composition tests cover Free, Collector, Seller, Store, empty portfolio, missing movement data, active session visibility, unavailable signal data, one primary navigation system, and bottom-navigation spacing contract.
- Planned: Route-level entitlement tests beyond the canonical contract.
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
2. Review `docs/REPOSITORY_CLEANUP_PLAN.md` and approve the cleanup classification before deleting or archiving anything.
3. Remove generated dependency/build artifacts in a dedicated cleanup PR after review.
4. Continue from the new canonical navigation contracts by auditing legacy dashboard imports and deciding which old navigation modules can be retired.
5. Review the new canonical membership catalog and approve Store employee-capacity configuration.
6. Audit API authentication and entitlement enforcement endpoint by endpoint.
7. Replay Supabase migrations in a fresh staging project and record the canonical schema.
8. Add CI coverage for auth, plan gates, billing webhooks, public share safety, API allowlists, mobile TypeScript, mobile tests, and Expo web export.
9. Continue design-system migration through shared dashboard states and common cards before attempting modal primitives.

## Recommended Identity Sprint 1

1. Draft and review a Supabase migration that replaces `is_platform_owner()` policies/functions with `user_roles`/`is_admin()`.
2. Replay migrations in staging to confirm `user_roles`, `admin_audit_log`, `admin_membership_overrides`, and billing tables converge cleanly.
3. Draft and review a Supabase migration replacing legacy `business` membership values and constraints with canonical `store`.
4. Add route-handler tests for privileged admin API permissions once a Next route test harness is configured.

## Recommended Membership Sprint 1

1. Review and approve the canonical plan catalog in `mobile/services/membership-catalog.ts`.
2. Verify Stripe price IDs match Collector $4.99/$49.99, Seller $14.99/$149.99, and Store $49.99/$499.99 before live billing.
3. Draft the `business` to `store` Supabase migration for billing subscriptions, admin overrides, trials, account plans, feature access, and admin helper functions.
4. Add endpoint-level entitlement enforcement tests for billing, admin overrides, and protected dashboard APIs.

## Recommended Navigation Sprint 1

1. Verify route content for labels marked Partially Implemented, especially mobile Store Business/Activity, mobile Signals, web Trade Binder, web Deal Desk, and web admin subareas.
2. Verify web and mobile admin navigation after the shared `user_roles` authority change.
3. Add server-side entitlement tests for dashboard routes so hidden navigation never becomes the only access control.
4. Retire unused sidebars and navigation definition files after confirming no active imports.

## Recommended Collector Organization Sprint 1

1. Review the proposed DB-side Free-plan enforcement path for native direct writes and offline replay.
2. Add integration tests around the Next.js Collector mutation route once route-handler fixtures are available.
3. Add native manual QA for failed mutation rollback, queued offline mutation replay, sign-out/user-switch isolation, and stale cached collection detail.
4. Decide whether condition and finish should remain JSON payload fields or become first-class columns in a reviewed schema migration.
5. Replay `202608050001_collector_mutation_security_proposal.sql` in staging and run `verify_collector_mutation_security.sql` before production approval.
6. Install or use approved disposable Supabase tooling for a clean migration replay; the current Codex environment has no `supabase`, `psql`, or Docker binary available.
7. Verify service-role inventory import behavior before production rollout; current audit found read-oriented service-role inventory access, while authenticated client/bulk upsert paths will be subject to the proposed trigger.
8. Run staging query-plan review for large Collector datasets, especially `ilike` search, JSON condition/finish filters, Trade Binder/Wishlist related filters, and price/quantity sorts.
9. Add web table virtualization and mobile `FlatList` tuning once realistic collection-size fixtures are available.

## Recommended Storage Location Sprint 1

1. Review the proposed storage hierarchy migration before production reliance on parent/child constraints, archived columns, favorites, and recent-location indexes.
2. Add route-handler or RPC-backed storage mutations if direct table writes become insufficient for workspace/store inventory sharing.
3. Add a visible mobile offline conflict-resolution surface for failed queued storage assignments.
4. Validate large-location manager performance with realistic location counts and card-count aggregations.

## Recommended Trade Binder/Wishlist Sprint 1

1. Decide whether wishlist exact printing requires `collector_number`, `language`, or `scryfall_id` columns before trade-calculator work begins.
2. Add production route/API tests for Trade Binder and Wishlist mutations once route-handler fixtures are available.
3. Add a dedicated offline conflict-resolution surface for failed Trade Binder and Wishlist queued writes.
4. Design trade-calculator and card-show prep flows as consumers of the current `TradeBinderItem`, `WishlistItem`, and `WishlistMatch` contracts.
