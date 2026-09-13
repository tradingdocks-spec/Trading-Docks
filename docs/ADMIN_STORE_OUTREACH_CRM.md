# Admin Store Outreach CRM

Status: Partially Implemented — Store Finder, saved prospects, conservative public contact discovery, admin-only routes, and the additive database foundation are included. Campaigns, templates, sequences, Resend sending, webhook processing, and analytics are intentionally deferred until their compliance and provider configuration gates are accepted.

## Architecture

The web app uses `/dashboard/admin/marketing/*` and server route handlers under `/api/admin/marketing/*`. Each page calls `requireServerPlatformRole("admin")`; each API handler repeats the authorization check. Google Places Text Search (New) runs server-side with `GOOGLE_PLACES_API_KEY`; the browser receives only normalized result fields. Search results are deduplicated by Google place ID before display or save.

Contact discovery is an explicit admin action. It fetches at most three public HTML pages, follows only likely Contact/About/Store/Info links, rejects private-network DNS targets and credential-bearing URLs, limits response size, and extracts only visibly published or `mailto:` addresses. It never guesses an email address.

## Routes

- `/dashboard/admin/marketing` — overview and pipeline state
- `/dashboard/admin/marketing/store-finder` — ZIP/radius discovery and save-to-prospect flow
- `/dashboard/admin/marketing/prospects` — searchable saved prospect list
- `/dashboard/admin/marketing/prospects/[id]` — prospect detail with public-contact discovery
- `/dashboard/admin/marketing/campaigns` — safe deferred-state page; no sending is enabled
- `POST /api/admin/marketing/store-finder`
- `GET|POST|PATCH /api/admin/marketing/prospects`
- `POST /api/admin/marketing/contact-discovery`

## Database

Migration: `supabase/migrations/202609120001_admin_store_outreach_crm.sql`

Tables: `marketing_searches`, `marketing_prospects`, `marketing_activities`, and `marketing_suppressions`. All tables enable RLS and restrict authenticated access to `public.is_admin('admin')`. Service-role access is server-only. Apply and verify in staging first; do not run this migration against production as part of deployment.

## Configuration

Optional variables are documented in `.env.local.example`: `GOOGLE_PLACES_API_KEY`, `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` (reserved for a separately restricted client map key), `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `RESEND_WEBHOOK_SECRET`, `MARKETING_REPLY_TO_EMAIL`, `MARKETING_PHYSICAL_ADDRESS`, and `NEXT_PUBLIC_APP_URL`.

Google Cloud setup must enable Places API (New), Text Search, and Geocoding, restrict the server key to the required APIs and server origins, and follow current Google Maps Platform attribution and retention rules. This release stores the stable place ID plus a bounded provider snapshot; independently entered CRM fields remain separate.

## Local validation

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, and `npm audit --omit=dev --audit-level=high`. To smoke-test the feature, sign in as a trusted administrator, open Store Finder, search a ZIP with and without Google credentials, save a result, confirm it appears once in Prospects, and exercise the contact-discovery API against a public test site. No live recipient or campaign send is used by tests.

## Next milestone

Add templates and campaigns only after sender identity, physical mailing address, unsubscribe tokens, suppression enforcement, Resend signature verification, idempotent recipient sends, and a review screen are implemented and tested. Sequence scheduling should use a reviewed cron-compatible endpoint and must remain paused by default.
