# Trading Docks production-readiness baseline

This release establishes a repeatable security and stability baseline. It does not claim that a source review alone can certify the live Supabase, Vercel, Stripe, Resend, eBay, DNS, or domain configurations.

## Verified in this release

- Production build completes successfully with Next.js 16.2.12.
- TypeScript completes as part of the production build.
- ESLint has no errors. Existing warnings remain tracked as technical debt.
- The production dependency audit reports zero known vulnerabilities.
- Root contract tests pass with `node --test --experimental-strip-types tests/*.test.ts`.
- Mobile TypeScript, Expo lint, and the full mobile test suite pass.
- Expo Web export completes for the active mobile application.
- Public pricing and landing calls to action use `/sign-up` and consume the canonical membership catalog.
- Public web metadata now defines a production canonical base, social share defaults, and noindex rules for sign-in and password utility routes.
- Mobile local account fallback no longer treats cached account type as paid membership authority.
- Mobile auth errors preserve the exact Supabase provider message in the visible error body while keeping internal configuration errors nontechnical.
- Server workspace access now resolves only a valid active workspace or a single unambiguous workspace membership.
- Scanner, Collector mobile mutation flows, and the web Collector mutation API page through inventory quantity totals instead of trusting the first 1,000 rows.
- Active marketplace import, enrichment, reconciliation, authorization, and OAuth callback routes now use the canonical `marketplaces.manage` capability guard.
- Core Supabase migrations enable row-level security for account, inventory, deck, workspace, marketplace, billing, trial, and feedback data.
- Deck, inventory, CSV, TCGCSV, and tool API families require an authenticated session at the proxy boundary.
- API requests declaring a body larger than 5 MiB are rejected.
- Diagnostic endpoints return 404 in production.
- Security response headers are configured globally, including CSP, HSTS, anti-framing, MIME sniffing protection, referrer controls, and a restrictive permissions policy.
- The tracked `.env.local` file has been removed from the distributable source.
- Pull requests and pushes to `main` now run install, lint, typecheck, production dependency audit, and production build checks.
- Supabase migration filenames now use unique migration versions and no root migration depends on an external `\i`/`\ir` SQL include.
- The platform role authority (`user_roles`, `current_admin_role`, `is_admin`, admin RPCs, and owner bootstrap helper) is represented in the root migration chain.
- The legacy `is_platform_owner()` database helper now delegates to `user_roles` owner authority instead of email identity.
- A fresh-bootstrap verification script exists at `supabase/verification/verify_fresh_bootstrap_contract.sql`.

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
11. For a fresh Supabase staging project, apply every file in `supabase/migrations` in filename order, then run `supabase/verification/verify_fresh_bootstrap_contract.sql`, `supabase/verification/verify_account_data_isolation.sql`, `supabase/verification/verify_collector_mutation_security.sql`, and `supabase/verification/verify_label_studio_inventory_qr.sql`.

## Running checklist

| Subsystem | Status | Notes |
| --- | --- | --- |
| Public website | Partially Verified | Build passes; pricing CTAs/catalog, landing CTAs, and public metadata are corrected. Browser E2E and visual QA remain required. |
| Web app shell and dashboard routes | Partially Verified | Route registry tests pass and `/dashboard/label-studio` builds. Server access avoids ambiguous workspace assignment; remaining workspace-specific routes still need browser QA. |
| Authentication | Partially Verified | Mobile auth contract tests pass and Supabase errors are visible. Staging Supabase email/redirect configuration must be verified manually. |
| Membership and billing | Partially Verified | Canonical catalog tests pass and RevenueCat/Stripe contracts are covered. Provider webhook staging/live delivery still needs environment QA. |
| Supabase data model and RLS | PARTIALLY VERIFIED | Migration filenames and include dependencies are fixed, platform role authority is in the root chain, and fresh-bootstrap verification now checks credential metadata and service Collector RPC grants. A real clean Supabase replay still must be run in staging. |
| Collector mutations | PARTIALLY VERIFIED | Application tests pass, mobile/web quantity totals no longer cap at the first page, and `202608100002_security_authority.sql` promotes DB-level Free-limit enforcement to an authoritative forward migration. It is not production-authoritative until applied and verified in Supabase. |
| Label Studio | Partially Verified | Route/API/public QR build and contract tests pass. New staging project must be bootstrapped and browser-tested. |
| Mobile app | Partially Verified | TypeScript, lint, tests, and Expo Web export pass. Physical-device scanner/auth/RevenueCat QA remains required. |
| Scanner native stack | Partially Verified | Automated mobile tests pass. Native device validation remains required for camera/OCR behavior. |
| Tooling and security gates | Partially Verified | Root lint now runs with zero errors and production audit reports zero vulnerabilities. Existing lint warnings remain tracked debt. |

## Known high-risk backlog

- Run and record a real clean Supabase staging replay with the root migration chain and verification scripts.
- Move active Card Shows purchase-order draft state out of browser-only storage if it is intended to be account-durable.
- Add browser E2E coverage for public signup, sign-in, dashboard routing, Label Studio, billing, and account isolation.
- Add production monitoring and alerting with secret/PII scrubbing.

## Database / Supabase Readiness

### Slice 3 Status Fields

| Area | Status | Notes |
| --- | --- | --- |
| SUPABASE CLEAN REPLAY | BLOCKED | Supabase CLI and `psql` are not installed locally, so clean replay was not actually demonstrated. Repository static checks pass and `verify_fresh_bootstrap_contract.sql` is updated for staging verification. |
| DB-LEVEL MEMBERSHIP ENFORCEMENT | PARTIALLY VERIFIED | `202608100002_security_authority.sql` makes Collector Free-plan quantity enforcement authoritative in the migration chain through trigger/RPC/advisory-lock guards. It still requires staging application and SQL verification before production. |
| RLS | PARTIALLY VERIFIED | Static tests and verification SQL cover representative user/workspace-owned tables. Real cross-user SELECT/INSERT/UPDATE/DELETE attempts still require a disposable Supabase replay. |
| BINDER SHARE SECURITY | PARTIALLY VERIFIED | Legacy binder-share creation now derives snapshots from authenticated owned `inventory_items`; revocation is scoped by `owner_id`; public rendering rejects invalid, inactive, revoked, and expired shares. Runtime isolation still needs staging/browser tests. |
| WORKSPACE OWNERSHIP | PARTIALLY VERIFIED | Marketplace routes use canonical capability guards and server workspace resolution avoids ambiguous fallback. A full mutating endpoint audit is not yet complete. |
| CREDENTIAL ROTATION READINESS | PARTIALLY VERIFIED | Marketplace credential rows now include algorithm and key-version metadata with backwards-compatible decrypt. Actual key rotation remains a manual production procedure and was not performed. |

### Verified

- Root migration versions are unique in the repository.
- Root migrations are self-contained; no migration file uses psql `\i` or `\ir` includes.
- The canonical platform role authority is now present in `supabase/migrations` rather than only under `mobile/supabase/migrations`.
- Storage configuration for `feedback-attachments` is represented in migrations as a private bucket with MIME and file-size restrictions.
- Collector mutation enforcement is represented database-side through triggers and RPCs with stable error codes, advisory locking, and Free-plan quantity checks.
- Marketplace credential encryption metadata is represented in the root migration chain for both user-owned and platform marketplace credentials.
- Static tests cover migration version uniqueness, include-free migrations, platform role replayability, Collector DB enforcement SQL, and the fresh-bootstrap verification contract.

### Fixed

- Renamed the initial July 24 migrations to unique Supabase versions while preserving their original order.
- Renamed the duplicate `202608020001_universal_cloud_persistence.sql` migration to `202608020003_universal_cloud_persistence.sql`.
- Inlined the order fulfillment and universal cloud persistence SQL that previously depended on root manual SQL snippets.
- Added `202608100001_platform_role_authority_replayability.sql` to make `user_roles` and admin RPCs reproducible from the root chain.
- Added `202608100002_security_authority.sql` to promote Collector inventory enforcement to an authoritative forward migration and add marketplace credential key-version metadata.
- Added `supabase/verification/verify_fresh_bootstrap_contract.sql` for post-replay staging verification.

### Still Blocked

- Supabase CLI is not installed in this local environment, so a real clean `supabase db reset` replay was not possible here.
- The Collector mutation authority migration must be validated in a disposable Supabase project before production rollout.
- Historical production may already have manually applied SQL with older filenames; production migration-history reconciliation is required before using CLI-linked production migrations.
- Some important integrity constraints, such as validating existing `inventory_items.location_id` values against `inventory_locations`, require data backfill/audit before safe production enforcement.

### Manual Production Steps

1. Do not run renamed historical migrations blindly against production until Supabase migration history is reconciled.
2. In the new staging project, apply the root migration chain in filename order.
3. Create a staging auth user through normal signup, then run the `promote_owner(email)` bootstrap from the SQL Editor for that staging user only.
4. Run all verification scripts under `supabase/verification`.
5. Review any verification failure as a schema bug or data-prep issue before production rollout.
6. For production, compare applied migration versions against the repository and create a reviewed reconciliation plan before connecting Supabase CLI.

### Required Environment Variables

- Web/Preview: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Mobile/Expo: `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Billing/webhooks as applicable: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `REVENUECAT_WEBHOOK_AUTHORIZATION`.
- Marketplace credentials: `MARKETPLACE_CREDENTIAL_ENCRYPTION_KEY`; optional `MARKETPLACE_CREDENTIAL_KEY_VERSION` for future key-rotation bookkeeping.

### Required Supabase Configuration

- Email auth enabled with the production and preview redirect URLs configured explicitly.
- Leaked-password protection and administrator MFA enabled.
- `pgcrypto` available for Label Studio SKU/QR token generation.
- Private `feedback-attachments` storage bucket and policies applied through migrations.
- RLS enabled on all user/workspace-owned tables listed in `verify_fresh_bootstrap_contract.sql`.

## Release gate

Run before every deployment:

```bash
npm ci
npm run check
npm run build
node --test --experimental-strip-types tests/*.test.ts
npm --prefix mobile run lint
npm --prefix mobile test
npx tsc --noEmit -p mobile/tsconfig.json
(cd mobile && npx expo export --platform web)
```

A deployment should be blocked on any command failure, any production dependency vulnerability rated high or critical, a failed cross-account isolation test, or an unreviewed database migration.
