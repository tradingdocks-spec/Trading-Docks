# Staging owner setup — September 6, 2026

**Requires owner configuration. Not implemented or certified. Both P0s remain OPEN.**

Project creation is blocked: this environment has no Supabase management connector, local login token, or authenticated browser session. No Supabase project was created, no Vercel environment configuration was changed, and no production database was accessed. Per the requested stop boundary, migration, seeding, verification-script guard implementation, and authenticated testing remain pending.

## Owner configuration

1. In the [Supabase Dashboard](https://supabase.com/dashboard), select the organization that owns Trading Docks and create a **new project** named `trading-docks-staging`. Choose an appropriate region and an available organization plan. Generate a unique database password and retain it in your password manager. Do not clone customer data from production. Record the newly generated project reference; it must differ from the existing shared project reference `bohddnajlnmknngzjsjk`.
2. From the new project's Connect/API settings, obtain its project URL, publishable key, legacy anon key, server service-role key, and database connection details. Keep all credentials in secure configuration. Actual generated values cannot be specified before the project exists. Do not send them in chat.
3. In Vercel project `trading-docks-346a`, Settings → Environment Variables, remove **Preview** scope from the existing shared Supabase entries while preserving their Production scope and values. Create separate Preview-only entries using the mapping below. Audit branch-specific overrides and integration-managed variables so none can restore production credentials to Preview. Do not rotate, overwrite, or redeploy Production.

| Variable | Preview value/source | Production treatment |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<new-staging-project-ref>.supabase.co` | Preserve existing production URL. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | New staging project's publishable key; this is the key the current app actually reads. | Preserve existing production key. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | New staging project's legacy anon key. Setting this alone does not configure the current app. | Keep any production entry production-only; obtain any newly required entry from that project, never staging. |
| `SUPABASE_SERVICE_ROLE_KEY` | New staging project's service-role key; server-only, sensitive. | Preserve production secret, Production scope only. |
| `DATABASE_URL` | New staging project's connection string from Connect; server-only, sensitive. Prefer the session connection appropriate to the available network for migration/verification tools. | Any existing production database configuration remains Production-only. No production DB access is needed for this task. |
| `APP_ENV` | Literal `staging`. | Preserve existing configuration; intended production identifier is `production`. |

`DATABASE_URL` and `APP_ENV` are configuration for the requested staging tooling; their presence alone does not establish an implemented environment guard. A public URL/key pair must belong to the same project as the server credential and database connection.

4. Keep migration access outside source control. Authenticate the Supabase CLI locally through its login flow, or make a management token available to the process through a secure credential store. Keep the staging database password/connection string in an ignored local file or process configuration. Provide only the non-secret staging project reference and app URL in the task. Verify file ignore rules before writing any credentials.
5. For local web development, explicitly configure `.env.local` with the staging URL, staging publishable key, required server credential, and `APP_ENV=staging`, or use a separately initialized local Supabase instance. The root `.env` also contains Expo public Supabase configuration: if that mobile environment is used, set its `EXPO_PUBLIC_SUPABASE_URL` and anon key consistently to local/staging. Do not assume changing web variables changes mobile configuration.
6. After the migration/guard checks below, build a **new Preview deployment** of the exact candidate branch against staging. Old Preview deployments do not acquire newly configured variables automatically. Configure staging Supabase Auth's Site URL and permitted redirect URLs for that Preview origin and the intended local callback URLs. Do not change production Auth settings.
7. Create synthetic staging QA users through staging Auth tooling. Store `PLAYWRIGHT_FREE_EMAIL`/`PLAYWRIGHT_FREE_PASSWORD`, `PLAYWRIGHT_COLLECTOR_EMAIL`/`PLAYWRIGHT_COLLECTOR_PASSWORD`, `PLAYWRIGHT_SELLER_EMAIL`/`PLAYWRIGHT_SELLER_PASSWORD`, and `PLAYWRIGHT_STORE_EMAIL`/`PLAYWRIGHT_STORE_PASSWORD` in secure local test-runner configuration. The suite also supports `PLAYWRIGHT_AUTH_EMAIL`/`PLAYWRIGHT_AUTH_PASSWORD`. Keep actual account identities/passwords out of reports. Provision corresponding staging entitlements and a second independent account for isolation coverage; authentication alone does not grant a tier. Do not create live billing transactions to seed QA entitlements.

Vercel supports separate environment scopes and sensitive values: [environment configuration](https://vercel.com/docs/environment-variables/manage-across-environments), [environment variable behavior](https://vercel.com/docs/environment-variables). Supabase documents project-based migration deployment in [database migrations](https://supabase.com/docs/guides/deployment/database-migrations).

## Resume gate, in order

- Verify staging project identity, separation from production, and consistency of all configured connections without printing secrets.
- Audit every launch script that can connect to a remote app/database. Implement and test a fail-closed guard before remote verification: require explicit staging identity, reject production or inconsistent targets, and validate the actual connection identity. `APP_ENV=staging` alone is insufficient. Add no production override for this task. Existing isolated PGlite checks are not remote staging tests.
- Initialize a clean Supabase staging database using the full ordered repository migration chain. Stop on the first error; do not skip migrations, fabricate prerequisite tables, or repair migration history to conceal failures. Prior PGlite fixtures used selected migrations and fixture prerequisites, so they do not certify the complete chain.
- Apply the chain preceding `202609060001_inventory_commit_boundaries_proposal.sql`, take and verify a staging backup, then apply that final proposal once through the tracked migration process. Inspect pending migration lists carefully because a generic push of the whole repository includes the proposal. Do not run an unreviewed push or remote reset.
- Run `supabase/verification/preflight_inventory_commit_boundaries.sql`; assess its returned schema, grants, functions, and guards rather than treating successful SQL execution as a passing preflight.
- Seed synthetic inventory, locations, orders, imports, and representative card data. Run the entire real database/API/UI matrix in `docs/P0_STAGING_VERIFICATION_2026-09-06.md`, including concurrency and fault injection confined to staging QA records. Verify authoritative state after every case.
- Run `supabase/verification/report_historical_fulfillment.sql` on synthetic staging data to validate its behavior. Production historical reconciliation remains a separate read-only production gate.

## Current result

| Requested result | Status |
| --- | --- |
| Staging Supabase project successfully isolated | NO |
| Preview uses staging rather than production | NO |
| Migration applied successfully to staging | NO — not run |
| Schema preflight passed on staging | NO — not run |
| Authenticated P0 scenarios passed | NO — not run |
| Database state verified after each scenario | NO — not run |
| Concurrency verified on staging | NO — not run |
| P0 Fulfillment | OPEN |
| P0 CSV Import | OPEN |

Remaining risks: shared Preview/Production configuration persists until owner setup; full migration-chain compatibility is unverified; remote script guards are not yet implemented; no real database/UI/concurrency evidence exists. Authentication, tenant isolation, billing, lint, production history, and final launch certification remain open. No production deployment occurred.
