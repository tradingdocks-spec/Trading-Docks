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
- Development-only mock send path with suppression checks and idempotency. It records a message and a mock delivery event but never calls an email provider.

## Data and security

Migration: `supabase/migrations/20260918231733_marketing_growth_engine_foundation.sql`

All new tables are additive, RLS-enabled, revoked from `anon`, granted only to `authenticated`, and restricted by `public.is_admin('admin')`. APIs also perform server-side admin authorization before using the service-role client.

No API keys, provider credentials, email bodies in logs, or secrets are stored by the growth engine. Suppression is checked before a mock message can be recorded. Provider events use unique IDs for idempotency.

The migration is a reviewed artifact only. It was not applied to staging or production.

## Owner configuration required for future production enablement

No new environment variables are required for the current mock-only foundation. Before enabling real delivery, the owner must configure and review:

- provider credentials through the approved server-side secret mechanism;
- sender name and sender email;
- reply-to address;
- legal business name and physical address;
- unsubscribe base URL;
- verified provider webhook signing secret and event mapping;
- approved email policies and suppression retention rules.

The `marketing_settings` row defaults to `email_provider = mock` and `outbound_enabled = false`. It must not be changed to production delivery without compliance, sender-domain, webhook, and review gates.

## Deferred work

P1: real provider adapter, signed webhooks, delivery/click/reply ingestion, sequence scheduler, reply classification, and outcome analytics.

P2: paid enrichment, social/ad publishing, video generation, automatic optimization, and autonomous follow-up.

The Asset Vault and Brand System pages currently expose the persisted foundation and honest next-step states; upload, deterministic render/export, and editing workflows are the next implementation slice.

## Validation

- TypeScript: passed.
- ESLint: passed with 0 errors; existing repository warnings remain.
- Full test suite: 766 passed, 0 failed.
- Production build: passed.
- `git diff --check`: passed.
- Local Supabase lint: not run successfully because Docker/Postgres was unavailable at `127.0.0.1:54322`; no remote database was touched.

## Safe operating rules

Use `Generate → Review → Approve → Mock send` in development. Do not apply the migration remotely, configure a real provider, or send outreach until the owner has reviewed compliance, sender identity, provider webhooks, suppression behavior, and the production enablement checklist.
