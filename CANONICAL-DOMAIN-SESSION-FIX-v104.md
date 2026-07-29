# Canonical domain and session fix — v104

- Uses `www.tradingdocks.com` as the single public application origin.
- Redirects the apex and Vercel technical domains to the canonical host before
  rendering or authentication.
- Scopes Supabase and Remember Me cookies to `.tradingdocks.com`, allowing the
  apex redirect and `www` application to share the same durable session.
- Checks the authenticated session in the root page as a second safeguard and
  sends authenticated visitors directly to `/dashboard`.
- Places the Next.js 16 proxy beside `src/app`. The prior root-level
  `proxy.ts` was outside the active source tree, so its session refreshes and
  authentication redirects were not executed.

After deployment, sign in once through `https://www.tradingdocks.com` so the
browser receives the newly domain-scoped cookies. Older host-only cookies
cannot be migrated by a website.
