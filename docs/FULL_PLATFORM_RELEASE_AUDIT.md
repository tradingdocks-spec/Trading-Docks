# Trading Docks Full Platform Release Audit

**Branch:** `codex/full-platform-release-audit`  
**Base:** `origin/main` at `d369635`  
**Audit date:** 2026-09-17  
**Status:** Code-verified for controlled release; live Supabase advisor/schema review incorporated; staging and authenticated browser gates remain

## Executive summary

This pass audited the active Next.js web application, the active Expo mobile application, route and API registries, shared access and entitlement contracts, inventory/Chaos Sort authorities, search semantics, provider boundaries, public share surfaces, and available regression coverage.

The repository is in good shape for a controlled release candidate. No new P0 security or data-integrity defect was confirmed by static review or the supplied live advisor review. The production build, TypeScript, full unit suite, lint, dependency audit, and route/interaction contracts pass. Live Trading Docks Supabase advisor findings for project `bohddnajlnmknngzjsjk` are incorporated below. Staging execution of the proposed security migrations, authenticated browser verification, provider credentials, and populated-workspace performance remain release gates.

This document separates **CODE VERIFIED** findings from **BROWSER / PRODUCTION VERIFICATION PENDING** findings. It does not authorize production deployment, migration execution, billing changes, or customer-data changes.

## Product map

### Public and auth surfaces

| Surface | Route(s) | Code status |
| --- | --- | --- |
| Marketing landing and pricing | `/`, `/pricing` | Verified by build and public route contracts |
| Authentication | `/sign-in`, `/sign-up`, `/forgot-password`, `/update-password`, `/auth/callback` | Verified by auth/session regression tests; live provider flow pending |
| Legal and security | `/privacy`, `/terms`, `/security` | Verified by build |
| Public portfolio/binder sharing | `/share/binder/[token]`, `/share/portfolio/[token]`, `/collectors/[username]`, `/collectors/[username]/[binderSlug]` | Token and ownership contracts pass; live privacy inspection pending |
| Showcase, kiosk, QR, and events | `/s/[storeSlug]`, `/kiosk`, `/q/[token]`, `/events/[tournamentSlug]` | Public route and registration contracts pass; live data/provider QA pending |

### Authenticated web workspace

The 72 dashboard page routes are classified by `src/lib/platform/route-access.ts` and covered by route-registry tests. They include dashboard/home, inventory and inbox, card detail, Chaos Sort and batches, filing/import/CSV, labels, portfolio, Deck Vault and Architect, showcase/kiosk/requests, purchasing and buying tools, marketplace and orders, analytics/intelligence, CRM/store operations, tournaments, settings, plans/billing, organization/employees, and admin/control-center surfaces.

### API and server boundaries

All 113 active API route handlers are classified by `src/lib/platform/api-access.ts`. The registry distinguishes authenticated capability routes from public share/event routes, OAuth callbacks, webhooks, and server-only/admin operations. Production build output confirms all handlers compile.

### Mobile

The active mobile app uses the five-tab account-aware navigation contract: Home, Collection/Business, Scan, Deal Desk or Signals, Activity, and Profile as appropriate to the effective account composition. Platform access tests verify Free, Collector, Seller, Store, Owner, and Admin behavior. Native runtime/store QA remains pending because no device session was available.

## Issue register

| ID | Route/component | Category | Severity | Description / reproduction | Root cause | Proposed fix | Status | Test coverage |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| AUD-001 | Supabase production project | Release / database | P0 | Production advisor review reports function privilege/search-path, RLS, and performance findings requiring staged verification. | Live findings are available, but proposed corrections have not been applied or replayed in staging. | Apply proposals in staging, run role-isolation checks, rerun advisors, then request production approval. | **Live findings incorporated; staging pending** | Supplied production advisor review; migration/test contracts |
| AUD-002 | Authenticated dashboard and mobile workspace | UX / performance | P1 | Exercise representative Free, Collector, Seller, Store, Owner, and Admin sessions on desktop, 390px, 768px, and native mobile. | No authenticated browser/device session available. | Run scripted smoke flows with real non-production test accounts and capture errors, timings, and screenshots. | **Pending browser/device QA** | Static route/access/interaction suites pass |
| AUD-003 | Share routes and public Showcase/Kiosk | Security / privacy | P1 | Verify revoked, expired, malformed, and cross-user tokens against deployed data; confirm no private metadata or inventory leakage. | Token contracts are present, but live project data is unavailable. | Execute read-only adversarial boundary cases in staging and confirm no-store/noindex behavior. | **Pending production-like verification** | `tests/database-security-authority.test.ts`, showcase/share tests |
| AUD-004 | Inventory, Chaos Sort, imports, marketplace imports, orders | Data integrity | P1 | Verify duplicate submission, retry, zero quantity, location/provenance preservation, idempotency, and cross-user mutation behavior with live rows. | Database enforcement depends on the deployed migration state and cannot be introspected here. | Run staging transaction/concurrency checks and verify migration history before release. | **Code verified; live DB pending** | inventory events, collector API, Chaos Sort, identity, security tests |
| AUD-005 | Third-party provider integrations | Reliability | P1 | Exercise unavailable/malformed/slow Scryfall, TCGTracking, eBay, Shopify/TCGplayer, Stripe/RevenueCat, Discord, and image-provider responses. | External credentials and provider environments are not available. | Run provider contract tests plus staged failure injection; confirm user-safe recovery states and timeouts. | **Code partially verified; provider QA pending** | provider, billing, Discord, image, and marketplace tests |
| AUD-006 | Dashboard-heavy workspaces | Performance | P1 | Measure populated large-account inventory, analytics, business summary, orders, CRM, and Deck Vault queries and bundle attribution. | No representative authenticated dataset or deployed telemetry. | Capture query plans/timings and route-level bundle reports before unrestricted launch. | **Pending performance evidence** | production build; static query review |
| AUD-007 | Web and mobile lint warnings | Maintainability | P2 | Full ESLint has 0 errors but 504 warnings, mostly existing `any`, unused symbols, and React effect guidance. | Historical code accumulated warning debt. | Triage by runtime risk; address warnings in focused passes rather than suppressing them globally. | **Open follow-up** | `npm run lint` |
| AUD-008 | Route taxonomy and legacy surfaces | UX / navigation | P2 | Several older feature families overlap (for example purchasing/buying aliases and showcase operations), even though links resolve. | Product surface grew incrementally. | Product-review canonical naming and redirect policy; keep aliases until usage is measured. | **Open product follow-up** | route registry and site interaction audit |
| AUD-009 | Public monitoring and Web Vitals | Operations | P2 | No active error-monitoring or Web Vitals provider was confirmed in the runtime dependency/source scan. | Observability is not yet part of the active runtime foundation. | Add approved monitoring with privacy review before broad public launch. | **Open release follow-up** | static dependency/runtime scan |
| AUD-010 | Source image masters and large dashboard chunks | Performance / polish | P3 | Large source brand assets and several large generated chunks remain; public image requests are optimized, but authenticated image-heavy screens need measurement. | Asset cleanup and route-level bundle attribution were deferred. | Optimize source masters and split only the measured high-impact client boundaries. | **Open optimization follow-up** | build artifact and prior performance audit |

No dead or placeholder action was confirmed by the automated interaction audit. No new source change was made merely to reduce cosmetic warning count or to guess at unavailable production state.

## Security and authorization review

**CODE VERIFIED**

- Dashboard proxy/session protection and auth-cookie handling have regression coverage.
- Route and API access registries classify all active dashboard pages and API handlers; unknown dashboard routes fail closed.
- Effective capabilities derive from canonical platform authority and entitlement state. Client-created access objects cannot self-escalate to Owner/Admin.
- Inventory mutations use server/database authority and transactional ledger/RPC paths in the audited contracts.
- Public share and binder APIs derive public cards from owned records and preserve revoked/expired share protections.
- Server-only service-role usage is isolated from browser/mobile public clients; source scans found no client `service_role` or secret-key exposure.
- RevenueCat webhook authentication and admin MFA server-cookie authority have dedicated tests.
- No unsafe `dangerouslySetInnerHTML`, `eval`, or `new Function` use was found in active web/mobile source.

**CURRENT VERIFIED PRODUCTION STATE / FOLLOW-UP**

- Production Security Advisor and Performance Advisor findings are recorded in the live follow-up section below.
- Staging verification is still required for `SECURITY DEFINER` execution grants, search paths, views, storage policies, and migration drift before production application.
- Provider credential presence, rotation metadata, and production deployment environment parity.

Do not revoke public RPC execution blindly: public Showcase, kiosk, event registration, OAuth callback, share-token, and webhook routes require intentional classification. Any privilege change should be a reviewed forward-only migration.

## Data integrity and search review

**CODE VERIFIED**

- Inventory identity includes game/set/collector/variant/language/provider identity rather than name-only matching.
- Quantity-to-zero, batch provenance, inventory events, location authority, Chaos Sort commits, and bulk removal have contract coverage.
- Shared search normalization covers case, whitespace, punctuation, set/code, collector number, condition, finish, SKU, and storage concepts. Global Search uses bounded live inventory queries rather than a stale JSON snapshot.
- Search preserves separate inventory positions and uses canonical card-detail routes.
- CSV/import and first-time UX tests cover consequence copy and recovery-oriented guidance.

**PENDING**

- Live concurrent/retry scenarios against the deployed database.
- Large-account pagination/query-plan verification.
- Production-like browser confirmation of recently updated inventory appearing consistently across search surfaces.

## UX, accessibility, mobile, and visual review

**CODE VERIFIED**

- The first-time guidance primitives are progressive rather than a wall of instructional text.
- Chaos Sort exposes its intake path and filing destination.
- Navigation and Create-menu contracts detect placeholder/dead actions and unauthorized dead ends.
- Theme token tests enforce required contrast pairs; route/build contracts cover responsive component composition.
- Dashboard route-level loading exists and audited API/workspace components expose error/empty paths in source.

**PENDING**

- Keyboard/screen-reader traversal, focus behavior, touch target verification, and visual overflow at 390px/768px/desktop on a signed-in account.
- Provider/network failure UX and full-page loading behavior under throttled conditions.

## Validation record

| Check | Result |
| --- | --- |
| TypeScript (`npm run typecheck`) | PASS |
| Full unit suite (`npm test`) | PASS — 746/746 |
| Focused route/access/security/UX suite | PASS — 63/63 |
| Production build (`npm run build`) | PASS — 142 generated pages/routes |
| ESLint (`npm run lint`) | PASS — 0 errors, 504 existing warnings |
| Dependency audit (`npm audit --omit=dev --audit-level=high`) | PASS — 0 vulnerabilities |
| `git diff --check` | PASS before this documentation commit; rerun after commit |
| Supabase local lint/advisors | Not available for Trading Docks; no Docker-backed local DB |
| Supabase remote advisors | Live results supplied for Trading Docks project `bohddnajlnmknngzjsjk`; not independently replayed by this shell session |
| Authenticated browser/E2E | Pending signed-in production-like session |

## Required production follow-up

1. Establish a clean review branch and stage `20260917154003_production_function_search_path_hardening.sql`.
2. Stage `20260917154008_production_function_privilege_hardening.sql` and the owner-authority transition only after reviewing the bootstrap guard.
3. Run anon, ordinary authenticated, Owner/Admin, trigger, mutation, and workspace-isolation regression checks.
4. Re-run Supabase Security Advisor and Performance Advisor; address only confirmed high-value findings.
5. Run authenticated browser QA for each account composition and key workflows, including inventory/Chaos Sort/imports, save-to-zero, search, shares, billing, and provider failures.
6. Capture populated-workspace timing/query plans and confirm monitoring/error reporting.
7. Review and merge this audit branch only after the P0/P1 gates have explicit owners and staging evidence.

## Release recommendation

**Recommended posture:** suitable for controlled staging validation; not certified for unrestricted public launch until AUD-001 through AUD-006 are closed or explicitly accepted by the release owner.

No production Supabase migrations were applied. No production deployment was triggered. No live billing or customer data was changed.

## Live Supabase advisor follow-up (2026-09-17)

Production Supabase project `bohddnajlnmknngzjsjk` was independently inspected and the current advisor results were supplied for this audit. The proposed migrations below are **not applied**. This repository shell does not have a separate authenticated connection for replay, so SQL execution evidence remains the supplied production inspection plus repository-level verification.

### Security findings and classifications

| Finding | Classification | Assessment | Planned action |
| --- | --- | --- | --- |
| 57 `SECURITY DEFINER` functions executable by `anon`; 60 by `authenticated` | Mixed | Advisor counts require per-function review; a blanket revoke could break public Showcase/event flows or authenticated mutation flows. | `20260917154008_production_function_privilege_hardening.sql` makes named high-risk grants explicit. |
| `admin_directory()`, `admin_feedback_queue()`, `admin_list_users()`, `admin_overview()`, `admin_set_membership_override()`, `admin_update_user_access()` | C — admin-only | Authenticated execution is intentional for the admin UI, but function bodies must enforce platform role. Live signatures were confirmed against the migration definitions; source definitions perform role checks where applicable. | Revoke `PUBLIC`/`anon`; preserve `authenticated`; stage-test Owner/Admin and ordinary-user denial. |
| `current_admin_role()`, `is_admin()`, `is_platform_owner()` | B — authenticated authority helpers | Used by policies and server access decisions; they return authority state rather than arbitrary user data. | Revoke `PUBLIC`/`anon`; preserve `authenticated`. |
| `apply_collector_inventory_mutation()`, `create_inventory_item_with_event()`, `move_inventory_lot_quantity()`, `remove_inventory_lot_quantity()` | B — authenticated user RPCs | These are active web/mobile mutation APIs. Their definitions derive `auth.uid()` and check owned rows/locations; removing authenticated execution would break supported workflows. | Revoke `PUBLIC`/`anon`; preserve `authenticated`; verify cross-user and workspace boundaries in staging. |
| `collector_effective_membership_tier()`, `enforce_collector_inventory_mutation()`, `inventory_events_block_mutation()`, `protect_platform_owner()` | E — trigger/internal helpers | No supported client call is present in active source. They are invoked by triggers or security-definer functions. | Revoke direct execution from `PUBLIC`, `anon`, and `authenticated`. Verify trigger execution after staging. |
| `inventory_event_text_value()`, `collector_inventory_error_payload()`, `raise_collector_inventory_error()` | E — internal helpers | Formatting/error helpers are not client APIs. | Revoke direct execution from all client roles. |

The privilege proposal deliberately does not alter public Showcase, kiosk, tournament registration, share-token, OAuth callback, or webhook functions because those are separate intentional public/server entry points and require route-specific verification.

### Hard-coded platform-owner authority

The literal `tradingdocks@gmail.com` appears in the historical migration definitions at:

- `202607260002_admin_control_center.sql`: `is_platform_owner()` and `protect_platform_owner()`.
- `202607280001_admin_membership_overrides.sql`: `admin_set_membership_override()` protects the legacy owner email, and `admin_directory()` maps that email to the `business` membership level.
- `202607270007_admin_user_directory_usage.sql`: the later `admin_directory()` replacement repeats the `business` mapping.

The current canonical role model is `public.user_roles(user_id, role)` with `admin_role` values including `owner`, and `current_admin_role()` / `is_admin()` already read that table. The legacy email fallback exists to bootstrap the original owner and prevent accidental removal, but it is not safe as a permanent authority: email identity can change, it is scattered across function definitions, and it conflates platform authority with a billing/membership label.

The proposed `20260917154750_platform_owner_role_authority_transition.sql` preserves bootstrap access transactionally by requiring the existing owner identity to exist, inserting/updating its `user_roles` row to `owner`, then switching `is_platform_owner()`, `protect_platform_owner()`, `admin_set_membership_override()`, and `admin_directory()` to trusted role authority. It also blocks membership overrides for any role-table owner rather than one email. This migration is intentionally **not applied**. If the bootstrap identity is absent, it fails rather than silently locking out the owner.

After staging, the target architecture is:

`auth.uid() → public.user_roles → admin_role = owner`

The release gate must include an Owner/Admin login, ordinary-user denial, last-owner protection, role recovery, and an explicit operational bootstrap/recovery procedure before production approval.

### Mutable search paths

Production flagged `workspace_role_rank`, `set_tcgplayer_magic_catalog_updated_at`, `set_tcgtracking_updated_at`, `inventory_event_text_value`, `collector_inventory_error_payload`, and `raise_collector_inventory_error`. The forward-only proposal `20260917154003_production_function_search_path_hardening.sql` pins each to `pg_catalog`; calls to project helpers are schema-qualified. This is a resolution-hardening change, not an authorization change. Apply only after staging replay confirms policy and trigger behavior.

### RLS enabled with no policy

The following are classified as intentionally inaccessible through the client Data API based on repository migrations and server-only call sites: `billing_provider_events`, `marketplace_oauth_tokens`, `platform_marketplace_integrations`, `tcgplayer_magic_catalog`, `tcgplayer_magic_catalog_imports`, `tcgtracking_price_snapshots`, `tcgtracking_product_mappings`, and `tcgtracking_sync_runs`. `binder_shares` is the exception requiring a production schema check because public sharing uses token-scoped server/page access; no broad authenticated table policy should be added merely to silence the advisor. The correct follow-up is to verify grants, server-only access, and token boundaries against production.

### Auth configuration

Leaked-password protection is currently disabled in production Supabase Auth. This branch does not change that setting. The release owner should enable it through the Supabase Auth configuration after reviewing user recovery implications.

### Performance advisor findings

Production reports 83 unindexed foreign keys, 55 RLS initplan warnings, 41 multiple-permissive-policy cases, one duplicate index, and many unused indexes. No blanket index or policy rewrite is proposed. Candidate high-value areas are `inventory_items`, `inventory_events`, Chaos Sort tables, orders/shipments, purchase ledger, Deck Vault tables, workspace membership, and tournament tables. Each candidate requires query-plan evidence and semantic review before a separate migration.

The duplicate `public.inbound_email_mailboxes` indexes (`inbound_email_mailboxes_one_per_workspace` and `inbound_email_mailboxes_workspace_id_key`) must first be identified as constraint-backed versus truly redundant; no drop is proposed in this branch.

RLS initplan optimization (`(select auth.uid())`) and multiple-policy consolidation are likewise deferred unless the exact policy semantics are proven equivalent. The existing repository already has optimized patterns in many recent migrations, and changing all historical policies would be unsafe without a live schema snapshot.

### Proposed migration order

1. Stage and verify `20260917154003_production_function_search_path_hardening.sql`.
2. Stage and verify `20260917154008_production_function_privilege_hardening.sql` with anonymous, ordinary authenticated, Owner/Admin, and supported mutation tests.
3. Only after advisor re-check and query-plan review, propose separate high-value index/RLS optimization migrations.
4. Handle leaked-password protection as an owner-controlled Auth configuration change, not SQL.

These migrations remain repository proposals only. **Supabase migrations applied remotely: NO.**
