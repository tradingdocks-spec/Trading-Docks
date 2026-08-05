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
- Implemented: Mobile auth provider restores sessions before rendering protected route stacks and subscribes to Supabase auth-state changes.
- Implemented: Mobile auth screen supports sign-up/sign-in with email/password, magic links, Google, and Apple paths where available.
- Implemented: Email/password sign-in calls Supabase `signInWithPassword`, shows visible loading, and renders exact Supabase error messages in the form.
- Implemented: The email/password form submits from the Sign in button and keyboard submit/Enter on Expo Web.
- Implemented: Remembered-email preferences store only the normalized email when selected; passwords are never stored locally.
- Implemented: The Supabase session uses a dedicated auth storage adapter: browser-safe `localStorage` on Expo Web and SecureStore with AsyncStorage fallback on native mobile.
- Implemented: Keep me signed in is recorded as an auth preference and session restoration discards non-persistent sessions on a new native launch or a new web browser session.
- Implemented: Mobile supports optional biometric locking of a restored session on native platforms.
- Implemented: Owner/Admin role lookup is preserved, but sign-in now routes users to their normal workspace while exposing Command Center as an additional protected destination.
- Partially Implemented: Mobile deep-link auth callback behavior requires production app scheme and provider configuration.
- Partially Implemented: Mobile admin routing reads `user_roles`, while web owner access is partly email-based.
- Partially Implemented: Native biometric/session-lock architecture is preserved, but native biometric behavior still requires device testing.
- Partially Implemented: Diagnostic logging exists for auth events, but production observability and log retention policies are not configured.

## Protected-Route Behavior

- Implemented: Mobile session restoration completes in `AuthProvider` before the root stack renders protected app routes.
- Implemented: Mobile tab navigation waits for local account-type restoration before evaluating account-specific labels and hidden tabs.
- Implemented: Mobile admin routes wait for auth and admin-role lookup before rendering, redirect anonymous users to `/auth`, and redirect non-admin signed-in users back to `/(tabs)`.
- Implemented: Web dashboard routes are protected server-side in `src/app/dashboard/layout.tsx`; anonymous users are redirected to `/sign-in?next=/dashboard`.
- Implemented: Web Command Center is protected server-side in `src/app/dashboard/admin/page.tsx`; non-owner users are redirected to `/dashboard`.
- Partially Implemented: Web owner access remains email-based while mobile admin access is role-table based.
- Partially Implemented: Mobile deep links and Expo Web refresh behavior rely on Expo Router route resolution and the auth root loading gate, but native OAuth/magic-link callback behavior still needs device validation.

## Authentication Problems

- Partially Implemented: Admin identity is inconsistent between web and mobile.
- Partially Implemented: Web owner access is hard-coded to `tradingdocks@gmail.com` in active dashboard code.
- Requires Production Configuration: Supabase Auth settings such as email confirmation, recovery link lifetime, leaked password protection, MFA, and OAuth providers must be verified in the Supabase dashboard.
- Requires Production Configuration: Google OAuth, Apple Sign In, magic-link redirect URLs, and native deep links must be verified in Supabase and app-platform settings.
- Implemented: Focused mobile tests cover successful sign-in, invalid credentials, session restoration, owner/admin routing, normal-user routing, remembered email, and keep-me-signed-in behavior.
- Planned: Add device-level tests for Google OAuth, Apple Sign In, biometric unlock, and native deep-link callback handling.
