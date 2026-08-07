# Mobile Production Environment

Status: Partially Implemented. This contract defines public mobile environment variables and release validation rules.

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

## Validation

- Implemented: `mobile/scripts/verify-production-release.js`.
- Implemented: `npm run verify:production-release`.
- Implemented: The validator checks production identifiers, app version/build fields, EAS profiles, forbidden public secrets, and development flags.
- Partially Implemented: Strict production Supabase and RevenueCat env validation runs when `NODE_ENV=production`; CI/staging should provide production-style public env values for that check.

## Release Blockers

- BLOCKER: Product owner must confirm whether documented support/legal defaults are acceptable for App Store and Play Store metadata.
- BLOCKER: Production builds must run `npm run verify:production-release` with production public env values before TestFlight or store submission.
