# Authentication

## Web Authentication

- Implemented: Supabase email/password sign-in, sign-up, password reset, password update, logout, and Google OAuth entry.
- Implemented: Server actions live in `src/app/actions/auth.ts`.
- Implemented: Auth callback handling lives in `src/app/auth/callback/route.ts`.
- Implemented: Browser and server Supabase clients live in `src/lib/supabase/client.ts` and `src/lib/supabase/server.ts`.
- Implemented: Session refresh, canonical host redirects, dashboard/onboarding protection, and API authentication defaults live in `src/lib/supabase/proxy.ts`.
- Implemented: A Remember Me cookie controls persistent versus browser-session Supabase cookie lifetime.
- Requires Production Configuration: Supabase redirect URLs, Google provider settings, canonical domain, and production cookie domain must match deployment.

## Mobile Authentication

- Implemented: Mobile Supabase client lives in `mobile/lib/supabase.ts`.
- Implemented: Mobile auth provider restores sessions and subscribes to auth state changes.
- Implemented: Mobile auth screen supports sign-up/sign-in with email/password, magic links, Google, and Apple paths where available.
- Implemented: Mobile supports optional biometric locking of a restored session on native platforms.
- Partially Implemented: Mobile deep-link auth callback behavior requires production app scheme and provider configuration.
- Partially Implemented: Mobile admin routing reads `user_roles`, while web owner access is partly email-based.

## Authentication Problems

- Partially Implemented: Admin identity is inconsistent between web and mobile.
- Partially Implemented: Web owner access is hard-coded to `tradingdocks@gmail.com` in active dashboard code.
- Requires Production Configuration: Supabase Auth settings such as email confirmation, recovery link lifetime, leaked password protection, MFA, and OAuth providers must be verified in the Supabase dashboard.
- Planned: Add automated tests for redirects, safe `next` handling, Remember Me behavior, and callback error handling.
