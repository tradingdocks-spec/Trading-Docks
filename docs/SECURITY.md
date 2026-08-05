# Security

## Implemented Controls

- Implemented: Global security headers in `next.config.ts`, including CSP, HSTS, frame denial, MIME sniffing protection, referrer policy, and permissions policy.
- Implemented: Production canonical host redirect in the request proxy.
- Implemented: Dashboard and onboarding authentication redirects.
- Implemented: API requests over 5 MiB are rejected at the proxy.
- Implemented: API responses receive `Cache-Control: no-store`.
- Implemented: Public share routes receive stricter cache, robot, and referrer headers.
- Implemented: Supabase service-role key is accessed only through server-side admin helper code.
- Implemented: Active web platform administration is authorized from `user_roles`, not from a hard-coded email address.
- Implemented: Server routes remain authoritative for web admin pages and privileged admin API actions; mobile access state is UX context only.
- Implemented: Marketplace credential migrations attempt to restrict encrypted payload columns.
- Implemented: Public share migrations revoke anonymous privileges from private tables.

## Requires Production Configuration

- Supabase secrets, RLS policies, email auth settings, OAuth provider callbacks, storage buckets, and migrations.
- Stripe secret key, publishable key, price IDs, webhook signing secret, and portal settings.
- Vercel environment variables, deployment protection, canonical domain, and log access controls.
- Cloudflare inbound email routing and webhook authentication.
- Marketplace provider credentials and callback URLs.
- Resend transactional email settings if email delivery is used.

## Security Concerns

- Partially Implemented: Public API allowlist includes market/image/search endpoints that may need durable rate limiting.
- Partially Implemented: Some provider callback and webhook routes are proxy-exempt and must rely on route-local verification.
- Partially Implemented: Repeated migrations and root SQL snippets increase risk of staging/production drift.
- Partially Implemented: Legacy migrations still contain `is_platform_owner()` and email-based policies. Active code no longer depends on them for admin route authorization, but production schema should be migrated to role-based policies in a dedicated database task.
- Partially Implemented: A tracked `.env.local` file exists in the working tree listing local configuration; do not add secrets and verify ignore rules before commits.
- Planned: Add automated cross-account data isolation tests.
- Planned: Add observability with secret and PII scrubbing.

## Access Fallbacks

- Failed role lookup: treat as normal user and deny privileged operations.
- Missing profile/account type: default to Free/collector-safe workspace behavior.
- Missing membership: default to Free entitlements.
- Stale billing data: past-due access is honored only while the current period is still in the future; otherwise Free fallback is used.
- Suspended account: deny entitlements and Command Center access.
- Admin role with normal subscription: keep normal subscription entitlements and add only admin Command Center authority.
