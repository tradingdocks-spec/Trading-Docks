# Repository Health

## Technical Debt

- Partially Implemented: Multiple dashboard systems coexist in `src/components/dashboard`, `src/components/dashboard-v2`, and older layout folders.
- Partially Implemented: Large historical release notes and backup mobile directories remain in the root.
- Partially Implemented: `node_modules-install-failed` appears in the repository tree and should not be part of product source.
- Partially Implemented: Root README still references an old binder removal release instead of the current OS foundation.
- Partially Implemented: Repository-wide lint currently fails with 67 errors and 414 warnings. These failures predate this documentation branch, and backup/archive directories contribute heavily to the failure count.
- Planned: Lint remediation should be handled in a dedicated stabilization task, not mixed into this documentation-only foundation branch.

## Authentication Problems

- Partially Implemented: Web owner access is hard-coded by email in dashboard code.
- Partially Implemented: Mobile admin access uses `user_roles`, creating a separate authorization model from web owner logic.
- Requires Production Configuration: Supabase Auth settings, OAuth callbacks, recovery flow settings, and MFA are not provable from source.

## Navigation Issues

- Partially Implemented: Multiple navigation definitions exist.
- Partially Implemented: Some routes exist in navigation but represent early workspace shells.
- Partially Implemented: Some implemented pages are not consistently represented in route capability docs.

## Component Duplication

- Partially Implemented: Dashboard shells, topbars, sidebars, workspace frames, metric cards, inventory workspaces, purchasing workspaces, deck vault components, and business operation components have overlapping versions.
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
- Planned: Generate a canonical Supabase schema snapshot from a clean migration replay.
- Planned: Move historical release notes/backups out of active source or clearly archive them.

## Performance Opportunities

- Planned: Audit large client components for bundle size and split heavy dashboard workspaces.
- Planned: Cache safe public card data with explicit provider limits and invalidation rules.
- Planned: Replace duplicate component systems with shared primitives to reduce CSS/runtime weight.

## Missing Tests

- Planned: Auth redirect and callback tests.
- Planned: Plan access and route entitlement tests.
- Planned: Billing webhook tests with signature and idempotency cases.
- Planned: Public share token validation tests.
- Planned: API route authentication allowlist tests.
- Planned: Supabase RLS/cross-account isolation tests.
- Planned: Mobile auth/session/offline queue tests.

## Documentation Gaps

- Partially Implemented: Historical docs exist as release notes, not durable architecture docs.
- Partially Implemented: Mobile README is still mostly default Expo text.
- Planned: Add a canonical environment variable matrix.
- Planned: Add provider setup runbooks for Stripe, Supabase, Cloudflare, eBay, Mana Pool, Resend, Vercel, and mobile app store builds.

## Recommended Sprint 1

1. Freeze new product features until architecture and membership contracts are reviewed.
2. Decide the canonical dashboard component/navigation system and deprecate duplicates.
3. Align web/mobile membership tier names, prices, limits, and source of truth.
4. Audit API authentication and entitlement enforcement endpoint by endpoint.
5. Replay Supabase migrations in a fresh staging project and record the canonical schema.
6. Add CI coverage for auth, plan gates, billing webhooks, public share safety, and API allowlists.
7. Remove or archive dependency/build backup artifacts after a separate review-approved cleanup.
