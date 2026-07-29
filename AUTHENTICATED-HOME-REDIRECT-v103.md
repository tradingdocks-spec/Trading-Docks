# Authenticated Home Redirect — v103

- Opening the main Trading Docks URL now checks the existing Supabase session.
- Authenticated users are redirected from `/` to `/dashboard`.
- Signed-out visitors continue to see the public landing page.
- Session refresh cookies are preserved during the redirect.
- Existing dashboard protection and sign-in redirects remain unchanged.
