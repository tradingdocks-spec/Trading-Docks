# Trading Docks OS Documentation

This directory is the engineering foundation baseline for the current Trading Docks repository state.

## Status Labels

- Implemented: Source code exists in the active app and is wired into routes or runtime entry points.
- Partially Implemented: Source exists, but behavior is incomplete, duplicated, demo-like, inconsistently enforced, or still needs hardening.
- Planned: Mentioned in docs, navigation, UI, or product direction, but no reliable implementation was found in active source.
- Requires Production Configuration: Code exists but depends on live provider settings, secrets, migrations, webhooks, DNS, app store configuration, or external validation.

## Documents

- [PRODUCT_BIBLE.md](./PRODUCT_BIBLE.md): Product surface and status map.
- [ARCHITECTURE.md](./ARCHITECTURE.md): Web, mobile, backend, and integration architecture.
- [DESIGN_SYSTEM.md](./DESIGN_SYSTEM.md): Current visual systems and duplication.
- [ROADMAP.md](./ROADMAP.md): Foundation-first roadmap.
- [MEMBERSHIPS.md](./MEMBERSHIPS.md): Web/mobile plan model and entitlement state.
- [AUTHENTICATION.md](./AUTHENTICATION.md): Web and mobile auth behavior.
- [SECURITY.md](./SECURITY.md): Current controls and production security gaps.
- [DATA_MODEL.md](./DATA_MODEL.md): Supabase migration inventory and ownership model.
- [OFFLINE_SYNC.md](./OFFLINE_SYNC.md): Current mobile offline queue state.
- [DEFINITION_OF_DONE.md](./DEFINITION_OF_DONE.md): Engineering completion bar.
- [REPOSITORY_HEALTH.md](./REPOSITORY_HEALTH.md): Risks, debt, and recommended Sprint 1.

## Current Repository Shape

- Implemented: Next.js 16 App Router web application in `src/app`.
- Implemented: Expo Router mobile application in `mobile`.
- Implemented: Supabase migration history in `supabase/migrations`.
- Implemented: Cloudflare inbound email worker scripts in `cloudflare`.
- Partially Implemented: Several generations of dashboard components coexist in `src/components/dashboard` and `src/components/dashboard-v2`.
- Partially Implemented: Historical root release notes and backup mobile directories are still present in the repository root.
- Requires Production Configuration: Supabase, Stripe, marketplace credentials, Cloudflare inbound email, Resend, Vercel, and mobile deep links.
