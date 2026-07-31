# Trading Docks production-readiness baseline

This release establishes a repeatable security and stability baseline. It does not claim that a source review alone can certify the live Supabase, Vercel, Stripe, Resend, eBay, DNS, or domain configurations.

## Verified in this release

- Production build completes successfully with Next.js 16.2.12.
- TypeScript completes as part of the production build.
- ESLint has no errors. Existing warnings remain tracked as technical debt.
- The production dependency audit reports zero known vulnerabilities.
- Core Supabase migrations enable row-level security for account, inventory, deck, workspace, marketplace, billing, trial, and feedback data.
- Deck, inventory, CSV, TCGCSV, and tool API families require an authenticated session at the proxy boundary.
- API requests declaring a body larger than 5 MiB are rejected.
- Diagnostic endpoints return 404 in production.
- Security response headers are configured globally, including CSP, HSTS, anti-framing, MIME sniffing protection, referrer controls, and a restrictive permissions policy.
- The tracked `.env.local` file has been removed from the distributable source.
- Pull requests and pushes to `main` now run install, lint, typecheck, production dependency audit, and production build checks.

## Required production actions

1. Rotate the Resend API key that appeared in the previously tracked `.env.local`. If any earlier revision ever contained service-role, Stripe, marketplace, or encryption credentials, rotate those too.
2. Keep all secret values in Vercel environment variables. Never commit `.env.local`.
3. Run `supabase/verification/verify_account_data_isolation.sql` in a safe staging Supabase project and confirm every assertion before production rollout.
4. Confirm all migrations in `supabase/migrations` have been applied in timestamp order to staging and production.
5. In Supabase, verify leaked-password protection, email confirmation, MFA for administrators, and short-lived recovery links are enabled.
6. In Stripe, verify the webhook signing secret, live/test mode separation, webhook delivery history, and idempotent subscription updates.
7. In Vercel, confirm preview and production secrets are separated, deployment protection is enabled where appropriate, and the canonical domain redirects correctly.
8. Add durable distributed rate limiting for public market and image proxy endpoints before a high-traffic launch. In-memory limiting is not reliable on serverless infrastructure.
9. Add production error monitoring and alerting with secret/PII scrubbing. No monitoring provider is currently configured in this source.
10. Perform authenticated browser tests on a staging deployment for sign-up, onboarding, inventory persistence, deck persistence, billing, password reset, marketplace credentials, mobile navigation, and cross-account data isolation.

## Release gate

Run before every deployment:

```bash
npm ci
npm run check
npm run build
```

A deployment should be blocked on any command failure, any production dependency vulnerability rated high or critical, a failed cross-account isolation test, or an unreviewed database migration.
