# Roadmap

## Foundation First

Do not add new production features until the foundation items below are reviewed.

## Sprint 1: Stabilize the Platform

- Implemented: Stabilize the active Expo auth screen, Supabase session restoration, remembered-email preferences, safe admin routing, and focused auth tests.
- Implemented: Establish first design-system foundation with shared semantic tokens, Expo/Next primitives, development-only showcases, focused primitive tests, and limited auth/profile/loading migrations.
- Implemented: Establish account-aware navigation contracts for active Expo tabs and the active Next.js dashboard shell, including protected admin access as an additive destination.
- Partially Implemented: Align route labels with canonical Collector, Seller, Store, and Admin navigation while leaving unfinished destination content clearly marked for later product sprints.
- Implemented: Establish shared identity/access models and move active web admin authorization from email checks to `user_roles`.
- Planned: Consolidate active dashboard component architecture and mark deprecated dashboard generations.
- Implemented: Align active web/mobile plan tiers, names, pricing, limits, entitlement keys, and provider mapping adapters around a canonical membership catalog.
- Planned: Audit API route authentication, public allowlists, provider callback exemptions, and server-side entitlement checks.
- Planned: Replace legacy Supabase `is_platform_owner()` policies/functions with role-based `is_admin()` equivalents in a reviewed migration.
- Planned: Replace legacy `business` membership schema values and constraints with canonical `store` in a reviewed migration.
- Planned: Verify Supabase migrations replay cleanly into a fresh staging project.
- Implemented: Establish a repository cleanup plan that classifies active apps, backups, generated output, duplicate components, duplicate services, duplicate navigation, duplicate design-system layers, and cleanup risk.
- Partially Implemented: Exclude confirmed backup/archive and generated output folders from active root lint scope.
- Implemented: Establish the first Collector Workspace foundation with shared collection models, mobile/web collection browsers, detail route foundations, and focused collection tests.
- Implemented: Add Collector organization actions for quantity, condition, finish, storage assignment, Trade Binder status, Wishlist state, optimistic rollback, and mobile offline queue de-duping.
- Partially Implemented: Deck usage, scanner recognition, portfolio analytics, trade transactions, and marketplace listing remain visible as integration points but not complete workflows.
- Implemented: Redesign mobile Home around a premium one-handed command-center hierarchy using real collection data, active sessions, unavailable states, and one primary bottom navigation system.
- Implemented: Polish the mobile bottom navigation into one compact, account-aware five-tab bar with consistent Ionicons, restrained center action treatment, selected state, safe-area sizing, and no Explore placeholder tab.
- Partially Implemented: Home market movement, recent activity, notifications, and operations signals remain unavailable until real data sources exist.
- Planned: Remove or archive backup dependency folders and historical release artifacts only after product-owner review.
- Planned: Add missing tests for auth redirects, plan gates, billing webhook behavior, public share token safety, and key route handlers.
- Planned: Add mobile CI or document why mobile validation is manual.
- Planned: Add native-device validation for biometric unlock, Google OAuth, Apple Sign In, and magic-link deep-link callbacks.
- Planned: Continue design-system migration in order: dashboard state surfaces, common cards/headers, input-heavy admin/settings screens, then modal/toast/chart/table primitives.
- Planned: Retire duplicated legacy navigation modules after import ownership is confirmed and missing route content is prioritized.
- Planned: Complete native visual QA for the polished bottom bar across small iPhone, large iPhone, Android, narrow Expo Web, larger text, and light/dark browser rendering.

## Sprint 2: Production Configuration Readiness

- Requires Production Configuration: Supabase Auth settings, email confirmation, leaked password protection, MFA for admins, applied migrations, storage buckets, and RLS verification.
- Requires Production Configuration: Stripe live/test separation, product/price IDs, webhook signing secret, and customer portal configuration.
- Requires Production Configuration: Vercel environment variables, deployment protection, canonical domain, and observability.
- Requires Production Configuration: Cloudflare inbound email DNS/routing and webhook validation.
- Requires Production Configuration: Marketplace credentials and provider app callback URLs.

## Sprint 3: Product Hardening

- Planned: Build durable sync/retry queues for mobile offline operations.
- Planned: Propose and review DB-side Free-plan card-limit enforcement for native direct writes and offline replay.
- Implemented: Create the Collector mutation security migration proposal and verification SQL for database-level ownership and Free-plan total-quantity enforcement.
- Partially Implemented: Expand the staging verification script to cover zero quantity, explicit overrides, missing identity data, duplicate replay, and service-role behavior notes; clean database replay is still pending approved Supabase tooling.
- Planned: Apply the Collector mutation security proposal only after staging replay, product-owner approval, and service-role/import impact review.
- Planned: Add distributed rate limiting for public image/market endpoints.
- Planned: Add production monitoring, structured logging, alerting, and PII scrubbing.
- Planned: Convert demo/sample surfaces into explicit empty states or real data-backed views.

## Later

- Planned: RevenueCat-backed mobile subscriptions if mobile in-app purchases become a production requirement.
- Planned: Native mobile release pipeline, app store signing, and deep-link verification.
- Planned: Multi-tenant workspace/team permission model hardening beyond current owner/member helpers.
