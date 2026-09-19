# Marketing Growth Engine

## Status

The admin-only P0 foundation is implemented on the `codex/admin-marketing-growth-engine` branch. It extends the existing Store Finder and prospect CRM without replacing the existing customer-consent marketing system.

Production deployment, remote Supabase migrations, real email sends, public scraping, paid enrichment, and autonomous outreach are intentionally disabled.

## Existing functionality reused

- `/dashboard/admin/marketing/store-finder` searches Google Places server-side and preserves provider provenance.
- `/dashboard/admin/marketing/prospects` stores provider IDs idempotently and links to prospect detail.
- `marketing_prospects` and `marketing_activities` remain the source of truth for discovered businesses and timeline events.
- `requireServerPlatformRole("admin")` protects the admin pages and API routes.
- Existing customer marketing tables and suppression-aware customer campaigns remain separate.

## Implemented P0 foundation

- Marketing dashboard and navigation surfaces for campaigns, Creative Studio, Outreach, Asset Vault, Brand System, Analytics, Suppression List, Settings, Store Finder, and Prospects.
- Controlled feature library seeded with currently supported Trading Docks concepts: Chaos Sort, Inventory Management, and Orders Center.
- Brand rules with approved language, prohibited claims, and visual restraint guidance.
- Prospect contacts, research signals, and feature-fit records with confidence and source provenance.
- First-class outbound campaign, creative brief, creative variant, outreach draft, message, event, generation-run, suppression, and settings models.
- Deterministic feature-fit, creative-brief, and outreach-draft generation. The generator is provider-neutral and does not invent metrics or claims.
- Human approval boundary: drafts must be explicitly approved before entering the queue.
- Development-only mock send path with suppression checks and idempotency. The first real-provider adapter is implemented but remains disabled unless every server-side readiness control passes.

## Data and security

Migration: `supabase/migrations/20260918231733_marketing_growth_engine_foundation.sql`

All new tables are additive, RLS-enabled, revoked from `anon`, granted only to `authenticated`, and restricted by `public.is_admin('admin')`. APIs also perform server-side admin authorization before using the service-role client.

No API keys, provider credentials, email bodies in logs, or secrets are stored by the growth engine. Suppression is checked before any send can be recorded. Provider events use unique IDs for idempotency.

The migration is a reviewed artifact only. It was not applied to staging or production.

## Owner configuration required for future production enablement

Real delivery uses the server-only variables documented below. Before enabling it, the owner must configure and review:

- provider credentials through the approved server-side secret mechanism;
- sender name and sender email;
- reply-to address;
- legal business name and physical address;
- unsubscribe base URL;
- verified provider webhook signing secret and event mapping;
- approved email policies and suppression retention rules.

The `marketing_settings` row defaults to `email_provider = mock` and `outbound_enabled = false`. It must not be changed to production delivery without compliance, sender-domain, webhook, and review gates.

## Deferred work

P1: sequence scheduler, reply classification, and outcome analytics beyond the normalized delivery-event foundation.

P2: paid enrichment, social/ad publishing, video generation, automatic optimization, and autonomous follow-up.

The Brand System, Sequences, and Templates pages remain foundation states. Asset Vault upload/review, deterministic render/export, campaign placement attachment, creative approval, outreach email preview, provider readiness, real-send gating, and signed webhook ingestion are implemented in the current slices.

## Validation

- TypeScript: passed.
- ESLint: passed with 0 errors; existing repository warnings remain.
- Full test suite: 774 passed, 0 failed.
- Production build: passed.
- `git diff --check`: passed.
- Local Supabase lint: not run successfully because Docker/Postgres was unavailable at `127.0.0.1:54322`; no remote database was touched.

The deterministic renderer was inspected as generated PNG output at 1080×1080, 1080×1350, 1080×1920, and 1200×628. The local admin browser reached the sign-in boundary, so authenticated Asset Vault and Creative Studio interaction at desktop/mobile viewports remains staging verification work.

## Safe operating rules

Use `Generate → Review → Approve → Mock send` in development. Real sending requires an approved draft, a current suppression check, complete sender/compliance configuration, Resend credentials, `VERCEL_ENV=production`, and `MARKETING_REAL_SEND_ENABLED=true`. Do not apply the migration remotely or send outreach until the owner has reviewed sender-domain authentication, provider webhooks, suppression behavior, and the production enablement checklist.

## Production email provider and webhook foundation

The selected first adapter is Resend. It uses the existing provider abstraction and server-side `fetch`, provides provider message IDs and an idempotency header, and supports signed Svix webhook events without adding a client-side credential dependency. The mock provider remains the default and no development/test path contacts a recipient.

The additive migration `20260919031004_marketing_email_delivery.sql` adds immutable message snapshots, normalized delivery states, provider webhook diagnostics, domain-authentication metadata, and an idempotent webhook-event ledger. It does not store API keys or webhook secrets and has not been applied remotely.

Real send is available only as a deliberate one-message action after the server revalidates approval, recipient normalization, suppression, sender/compliance readiness, provider configuration, and `MARKETING_REAL_SEND_ENABLED=true` in a production deployment. Ambiguous provider outcomes are not silently retried. The message snapshot retains the body, subject, CTA, sender, campaign, prospect, creative, version, and content hash.

`/dashboard/admin/marketing/settings` displays provider, sender, compliance, domain-authentication, and real-send readiness without exposing secrets. The signed Resend endpoint is `/api/marketing/webhooks/resend`; it rejects missing/invalid signatures, deduplicates provider events, normalizes sent/delivered/opened/clicked/bounced/complained/failed events, and creates suppression records for hard bounces, complaints, and unsubscribes. Open events are labeled as tracked opens rather than guaranteed reads, and unsubscribe clicks are not counted as CTA clicks.

Required server-only configuration:

- `MARKETING_EMAIL_PROVIDER` — `mock` by default; set to `resend` only when reviewed.
- `MARKETING_EMAIL_API_KEY` — Resend API key; never expose to the browser.
- `MARKETING_EMAIL_WEBHOOK_SECRET` — Resend signing secret; never persist in `marketing_settings`.
- `MARKETING_REAL_SEND_ENABLED` — must be exactly `true` and is honored only when `VERCEL_ENV=production`.

Non-secret sender/compliance values are stored in the existing singleton `marketing_settings` row: `from_name`, `from_email`, `reply_to`, `business_name`, `business_address`, `unsubscribe_base_url`, `sending_domain`, `spf_status`, `dkim_status`, `dmarc_status`, and `tracking_domain`.

## Campaign workflow and outreach preview

The additive migration `20260919013616_marketing_campaign_workflow.sql` adds creative review metadata, placement validation, mock-send provenance fields, and an admin-only campaign activity timeline. It does not replace the existing campaign, creative, prospect, or outreach tables. Staging migration validation remains blocked by the previously documented remote migration drift; no remote migration was applied.

Campaign detail is available at `/dashboard/admin/marketing/campaigns/[id]`. Attachments are keyed by explicit placement (`email_hero`, social, or Google/LinkedIn/X variants), and the server checks creative approval plus exact platform dimensions before attaching. A placement can be replaced or removed without deleting the creative. Creative review actions preserve the original row and record reviewer, timestamps, rejection reason/notes, and campaign activity; duplicate/variant actions preserve parent and variant-group lineage.

Outreach review at `/dashboard/admin/marketing/outreach` now loads a complete admin-only preview from the existing draft and campaign references. It supports desktop, mobile, and plain-text views; includes the approved email hero only when an approved `email_hero` placement exists; shows an explicit missing-creative warning otherwise; and displays personalization signals, source URLs, claim provenance, sender readiness, suppression state, and deterministic approval checks. Approval is blocked when recipient, body, campaign, feature, CTA, claims, suppression, or sender identity requirements fail. Mock send remains the only send path, uses a stable `draft + approved version` idempotency key, stores campaign/creative/prospect/body-hash provenance, records a mock delivery event, and never contacts a recipient.
## Asset Vault and deterministic creative renderer

The additive migration `20260919010406_marketing_asset_renderer.sql` extends the existing `marketing_assets` table rather than creating a second asset store. It adds controlled asset types, approval state, source and license provenance, product-display and marketing-use approval flags, archive state, and searchable indexes. The migration also provisions the private `marketing-assets` Supabase Storage bucket with authenticated admin-only policies. It is not applied by this task.

`/dashboard/admin/marketing/assets` now provides an admin-only upload and review workspace. Uploads accept PNG, JPEG, and WebP only, are limited to 10 MB, use a private storage path, retain dimensions and provenance metadata, and begin in `draft`. An asset cannot be approved without an explicit commercial-use approval flag. Reads use short-lived signed URLs; private storage is never made public.

`/dashboard/admin/marketing/creative-studio` now provides deterministic composition controls for feature, campaign, platform, composition family, headline, supporting copy, CTA, and an approved product screenshot. The renderer supports Product Hero, Product + Cards, Feature Spotlight, Operational Pain, Workflow, and Minimal Editorial families. Platform formats are rendered independently at 1080×1080, 1080×1350, 1080×1920, 1200×1200, 1200×628, and the related email/social landscape formats. Structured `render_spec`, dimensions, asset IDs, quality issues, and optional lineage are persisted on `marketing_creatives`; the flattened output is reproducible from that specification.

Preview output is SVG generated from actual copy and selected approved assets. Admin export routes produce PNG or JPEG using the installed server image runtime. The renderer deliberately shows an “Approved product screenshot required” state when no approved product visual exists instead of fabricating a dashboard or card art. Creative save rejects restricted, archived, or commercially unapproved assets. Campaign attachment and email preview integration remain the next wiring step after the staging migration is validated.

Canonical screenshot capture is intentionally documented rather than implemented as brittle browser automation. The recommended workflow is to capture stable internal demo states through the existing authenticated admin UI, upload the resulting owned screenshots into Asset Vault, record source/license notes, and approve them before using them in Creative Studio.
