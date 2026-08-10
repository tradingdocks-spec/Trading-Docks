# Mobile Production Environment

Status: Partially Implemented. This contract defines public mobile environment variables and release validation rules.

Server-only billing variables for the Next.js backend are documented here because paid mobile subscriptions depend on backend reconciliation. These variables must be configured in the hosting environment, not in EAS public mobile env.

## Required

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL for mobile auth/data. | Required; must point to the approved production Supabase project. |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key for mobile client. | Required; must be publishable/anon only and must not start with `sb_secret`. |
| `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` | RevenueCat public iOS SDK key for native Apple subscriptions. | Required once mobile purchases are enabled; public SDK key only, never a RevenueCat secret REST API key. |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | RevenueCat public Android SDK key for future Google Play subscriptions. | Required once mobile purchases are enabled; public SDK key only, never a RevenueCat secret REST API key. |

## Optional With Documented Defaults

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_SUPPORT_URL` | `mailto:tradingdocks@gmail.com` | Support and account-deletion request contact. |
| `EXPO_PUBLIC_PRIVACY_URL` | `https://www.tradingdocks.com/privacy` | Privacy Policy link. |
| `EXPO_PUBLIC_TERMS_URL` | `https://www.tradingdocks.com/terms` | Terms of Service link. |

These defaults come from existing repository documentation and public legal routes. No localhost or development URL is allowed for production.

## Development Only

| Variable | Purpose | Production rule |
| --- | --- | --- |
| `EXPO_PUBLIC_ENABLE_SCANNER_DIAGNOSTICS` | Enables camera/scanner diagnostics. | Must not be `true` in production. |
| `EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER` | Enables private scanner benchmark builder. | Must not be `true` in production. |
| `EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE` | Enables design-system showcase. | Must not be `true` in production. |

## Forbidden In Public Mobile Env

- Any `EXPO_PUBLIC_*` variable containing `SERVICE_ROLE`.
- Any `EXPO_PUBLIC_*` variable containing `SUPABASE_SERVICE_ROLE`.
- Any `EXPO_PUBLIC_*` variable containing `SUPABASE_SECRET`.
- Any `EXPO_PUBLIC_*` value containing `sb_secret`.
- Any secret provider key, OAuth secret, webhook secret, signing secret, private token, or service credential.
- RevenueCat webhook secrets and REST API keys. Mobile may contain only public SDK keys.

## Server-Only Billing Environment

| Variable | Purpose | Exposure rule |
| --- | --- | --- |
| `REVENUECAT_WEBHOOK_AUTHORIZATION` | Shared authorization value checked by `/api/webhooks/revenuecat`. | Server-only; configure in the Next.js hosting environment as a secret/sensitive value. |
| `SUPABASE_SERVICE_ROLE_KEY` | Existing server admin key used by trusted webhook code to reconcile provider state. | Server-only; never expose to mobile or browser JavaScript. |
| `NEXT_PUBLIC_SUPABASE_URL` | Existing server/web Supabase project URL used by the admin client. | Public URL is acceptable, but it does not grant access without the service-role key. |

No RevenueCat secret REST API key is required by the current implementation because the webhook reconciles authenticated event payloads and does not call RevenueCat's REST API. Add one only if future server-side customer-state verification is implemented.

## Validation

- Implemented: `mobile/scripts/verify-production-release.js`.
- Implemented: `npm run verify:production-release`.
- Implemented: The validator checks production identifiers, app version/build fields, EAS profiles, forbidden public secrets, and development flags.
- Partially Implemented: Strict production Supabase and RevenueCat env validation runs when `NODE_ENV=production`; CI/staging should provide production-style public env values for that check.

## Release Blockers

- BLOCKER: Product owner must confirm whether documented support/legal defaults are acceptable for App Store and Play Store metadata.
- BLOCKER: Production builds must run `npm run verify:production-release` with production public env values before TestFlight or store submission.
