# Trading Docks v101

## Persistent session redirect fix

- Preserves every Supabase `Set-Cookie` value when authentication middleware
  redirects between sign-in, onboarding, and dashboard routes.
- Retains refreshed and rotated access/refresh token cookie chunks instead of
  dropping them on a newly created redirect response.
- Preserves Supabase cookie deletion instructions during sign-out or invalid
  session cleanup.
- Keeps the existing remembered-email behavior and standard long-lived
  Supabase session lifecycle.
- Production build passed all 72 application pages.

