# Remember Me Stable Session — v100

This update replaces the custom Supabase authentication-cookie rewriting with
Supabase SSR's standard persistent session handling.

- Auth sessions now use Supabase SSR's supported long-lived cookie lifecycle.
- Refresh-token rotation no longer passes through competing browser, server,
  and proxy lifetime policies.
- Closing and reopening a normal browser preserves the signed-in session.
- Explicit Sign Out still revokes and clears the session.
- The Remember Me control continues to save or remove the email address.
- Passwords are never stored by Trading Docks.

After deploying, sign in once at `https://www.tradingdocks.com` in a normal
(non-private) browser window. Older cookies from v99 are replaced during that
sign-in.
