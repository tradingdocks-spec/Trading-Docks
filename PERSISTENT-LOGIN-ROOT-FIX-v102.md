# Persistent login root fix

This release applies one session-lifetime policy to every place Supabase can
write or rotate authentication cookies.

- Auth cookies receive a one-year `Max-Age` on login and token refresh.
- Browser, server, and middleware clients use the same persistent policy.
- Redirects replay the original cookie options instead of reconstructing
  cookies and accidentally dropping `Max-Age` or `Expires`.
- Supabase cookie-deletion instructions remain intact for Sign Out and revoked
  sessions.
- Access tokens still expire and rotate normally; the refresh session is what
  survives closing and reopening the browser.

After deployment, users should sign in once through the canonical
`https://www.tradingdocks.com` address. Testing must use a normal browser window
with "clear cookies/site data when closed" disabled.
