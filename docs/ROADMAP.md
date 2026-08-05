# Roadmap

## Foundation First

Do not add new production features until the foundation items below are reviewed.

## Sprint 1: Stabilize the Platform

- Implemented: Stabilize the active Expo auth screen, Supabase session restoration, remembered-email preferences, safe admin routing, and focused auth tests.
- Implemented: Establish first design-system foundation with shared semantic tokens, Expo/Next primitives, development-only showcases, focused primitive tests, and limited auth/profile/loading migrations.
- Implemented: Establish account-aware navigation contracts for active Expo tabs and the active Next.js dashboard shell, including protected admin access as an additive destination.
- Partially Implemented: Align route labels with canonical Collector, Seller, Store, and Admin navigation while leaving unfinished destination content clearly marked for later product sprints.
- Planned: Consolidate active dashboard component architecture and mark deprecated dashboard generations.
- Planned: Align plan tiers, names, pricing, and limits between web and mobile.
- Planned: Audit API route authentication, public allowlists, provider callback exemptions, and server-side entitlement checks.
- Planned: Verify Supabase migrations replay cleanly into a fresh staging project.
- Planned: Add repository hygiene cleanup for backup dependency folders and historical release artifacts.
- Planned: Add missing tests for auth redirects, plan gates, billing webhook behavior, public share token safety, and key route handlers.
- Planned: Add mobile CI or document why mobile validation is manual.
- Planned: Add native-device validation for biometric unlock, Google OAuth, Apple Sign In, and magic-link deep-link callbacks.
- Planned: Continue design-system migration in order: dashboard state surfaces, common cards/headers, input-heavy admin/settings screens, then modal/toast/chart/table primitives.
- Planned: Retire duplicated legacy navigation modules after import ownership is confirmed and missing route content is prioritized.

## Sprint 2: Production Configuration Readiness

- Requires Production Configuration: Supabase Auth settings, email confirmation, leaked password protection, MFA for admins, applied migrations, storage buckets, and RLS verification.
- Requires Production Configuration: Stripe live/test separation, product/price IDs, webhook signing secret, and customer portal configuration.
- Requires Production Configuration: Vercel environment variables, deployment protection, canonical domain, and observability.
- Requires Production Configuration: Cloudflare inbound email DNS/routing and webhook validation.
- Requires Production Configuration: Marketplace credentials and provider app callback URLs.

## Sprint 3: Product Hardening

- Planned: Build durable sync/retry queues for mobile offline operations.
- Planned: Add distributed rate limiting for public image/market endpoints.
- Planned: Add production monitoring, structured logging, alerting, and PII scrubbing.
- Planned: Convert demo/sample surfaces into explicit empty states or real data-backed views.

## Later

- Planned: RevenueCat-backed mobile subscriptions if mobile in-app purchases become a production requirement.
- Planned: Native mobile release pipeline, app store signing, and deep-link verification.
- Planned: Multi-tenant workspace/team permission model hardening beyond current owner/member helpers.
