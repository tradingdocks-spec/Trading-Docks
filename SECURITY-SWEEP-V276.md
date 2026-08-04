# Trading Docks Security Sweep — v276

## Implemented controls

### Public binder and portfolio links

- Random 128-bit-equivalent hexadecimal share tokens
- Strict token-format validation before database access
- Active, revoked, and expiration checks
- Read-only sanitized snapshots
- Anonymous access denied to inventory, locations, profiles, binders, trade
  statuses, and trade-request tables
- Public pages never query private tables in the browser
- Public links are `noindex`, `nofollow`, `noarchive`
- Share responses use `no-store` and `no-referrer`
- Client-submitted legacy binder payloads are server-sanitized and allowlisted
- Card count, string length, URL host, number, and quantity limits
- Only approved HTTPS image hosts are rendered
- Account required for trade interactions and other write actions
- Sign-up and sign-in return visitors to the exact shared link
- Share links can be revoked without deleting the binder
- Owner-only RLS policies for share management

### Site/API permission sweep

- Dashboard and onboarding remain authentication-gated
- API routes are now authenticated by default
- Only an explicit list of read-only public APIs is anonymous
- Billing webhooks, inbound-email webhooks, and marketplace callbacks remain
  exempt because they use provider verification flows
- API responses receive `Cache-Control: no-store`
- Request bodies remain capped at 5 MB at the proxy
- Global CSP, HSTS, frame denial, MIME sniffing protection, and restrictive
  browser permissions remain enabled
- Added Cross-Origin-Opener-Policy and Cross-Origin-Resource-Policy

## Required migration

Run:

`supabase/migrations/202608030050_public_share_security.sql`

## Important operational checks

These controls materially harden the application, but no static sweep can prove
that a live deployment is invulnerable. Before public launch:

1. Confirm `SUPABASE_SERVICE_ROLE_KEY` exists only in Vercel server-side
   environment variables and is never prefixed with `NEXT_PUBLIC_`.
2. Rotate marketplace, Stripe, email-webhook, and Supabase secrets if they were
   ever pasted into source control or public chat.
3. Enable Supabase leaked-password protection and MFA for owner/admin accounts.
4. Review Vercel logs for repeated 401, 403, 413, and webhook-signature failures.
5. Run dependency auditing in the canonical repository:
   `npm audit --omit=dev`
6. Add durable distributed rate limiting before high-volume public launch.
   In-memory rate limits are not reliable across Vercel serverless instances.
7. Perform authenticated and anonymous penetration testing against the deployed
   preview URL.

## API route review

| Route | Methods | Authentication boundary |
|---|---|---|
| `src/app/api/admin/marketplace-integrations/route.ts` | GET, POST, PATCH | Yes |
| `src/app/api/admin/trials/invitations/route.ts` | POST | Yes |
| `src/app/api/admin/users/route.ts` | GET, PATCH, DELETE | Yes |
| `src/app/api/billing/checkout/route.ts` | POST | Yes |
| `src/app/api/billing/portal/route.ts` | POST | Yes |
| `src/app/api/billing/webhook/route.ts` | POST | Yes |
| `src/app/api/binder-shares/route.ts` | POST | Yes |
| `src/app/api/buylist/mtgjson/route.ts` | POST, GET | Yes |
| `src/app/api/card-shows/diagnostic/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/card-shows/image/[id]/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/card-shows/search/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/collector-portfolio/binders/route.ts` | PUT | Yes |
| `src/app/api/collector-portfolio/profile/route.ts` | PUT | Yes |
| `src/app/api/collector-portfolio/shares/route.ts` | POST | Yes |
| `src/app/api/csv-converter/resolve/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/deck-vault/card-image/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/deck-vault/card-search/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/deck-vault/commander-art/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/deck-vault/deck-doctor/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/deck-vault/external-card-resolve/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/deck-vault/game-changers/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/deck-vault/import-resolve/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/deck-vault/import-url/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/deck-vault/intelligence/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/deck-vault/replacements/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/inventory/card-search/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/landing-card-image/[set]/[number]/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/market-cards/diagnostic/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/market-cards/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/market-intelligence/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/marketplaces/[marketplace]/callback/route.ts` | GET | Yes |
| `src/app/api/marketplaces/catalog/enrich/route.ts` | POST | Yes |
| `src/app/api/marketplaces/credentials/route.ts` | POST, GET, DELETE | Yes |
| `src/app/api/marketplaces/ebay/authorize/route.ts` | GET | Yes |
| `src/app/api/marketplaces/ebay/import/route.ts` | POST | Yes |
| `src/app/api/marketplaces/ebay/listing-image/[id]/route.ts` | GET | Yes |
| `src/app/api/marketplaces/ebay/reconciliation/route.ts` | GET | Yes |
| `src/app/api/marketplaces/email-import/route.ts` | GET, POST | Yes |
| `src/app/api/marketplaces/email-inbox/route.ts` | GET, POST, DELETE | Yes |
| `src/app/api/marketplaces/manapool/import/route.ts` | POST | Yes |
| `src/app/api/multi-game-market/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/orders/bulk/route.ts` | PATCH | Yes |
| `src/app/api/orders/email-process/route.ts` | POST | Yes |
| `src/app/api/orders/email-review/route.ts` | GET, PATCH | Yes |
| `src/app/api/orders/fulfillment/route.ts` | PATCH | Yes |
| `src/app/api/orders/reconciliation/route.ts` | PATCH | Yes |
| `src/app/api/orders/tcgplayer-csv/route.ts` | POST | Yes |
| `src/app/api/purchasing/card-photo-scan/route.ts` | POST | Proxy/Allowlist |
| `src/app/api/scryfall-card-image/[set]/[number]/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/scryfall-image/[id]/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/tcg-image/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/tcgcsv/image/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/tcgcsv/sealed/search/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/tcgcsv/sync/route.ts` | GET | Proxy/Allowlist |
| `src/app/api/tools/csv/tcgplayer-enrich/route.ts` | POST | Yes |
| `src/app/api/webhooks/cloudflare-email/route.ts` | POST | Yes |
