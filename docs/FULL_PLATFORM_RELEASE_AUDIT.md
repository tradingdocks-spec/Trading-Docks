# Trading Docks Full Platform Release Audit

**Branch:** `codex/full-platform-release-audit`  
**Base:** `origin/main` at `d369635`  
**Audit date:** 2026-09-17  
**Status:** Code-verified for controlled release; authenticated production and Supabase verification pending

## Executive summary

This pass audited the active Next.js web application, the active Expo mobile application, route and API registries, shared access and entitlement contracts, inventory/Chaos Sort authorities, search semantics, provider boundaries, public share surfaces, and available regression coverage.

The repository is in good shape for a controlled release candidate. No new P0 security or data-integrity defect was confirmed by static review or the available contract tests. The production build, TypeScript, full unit suite, lint, dependency audit, and route/interaction contracts pass. The main release limitation is environmental: no authenticated production-like browser session or Trading Docks Supabase project is connected to this audit environment, so live row isolation, advisor findings, migration drift, provider credentials, and populated-workspace performance remain unverified.

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
| AUD-001 | Supabase production project | Release / database | P0 | Connect the Trading Docks project and compare live schema/history with repository migrations. Current CLI account exposes only the unrelated Part Detector project. | Missing project access in this environment. | Grant least-privilege project access, run security/performance advisors and read-only drift checks, then prepare forward-only repairs if needed. | **Pending production access** | CLI project listing; repository migration review |
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

**PENDING**

- Supabase Security Advisor and Performance Advisor for the Trading Docks project.
- Live verification of RLS, `SECURITY DEFINER` execution grants, search paths, views, storage policies, and migration drift.
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
| Supabase local lint/advisors | Not available for Trading Docks; no linked project/Docker-backed local DB |
| Supabase remote advisors | Not run; current authenticated account exposes only Part Detector (`tnfrvxwpxuqkgafatzwg`) |
| Authenticated browser/E2E | Pending signed-in production-like session |

## Required production follow-up

1. Connect the Trading Docks Supabase project and run read-only schema/history, Security Advisor, and Performance Advisor checks.
2. Validate repository migration order against actual production history; create only forward-only repair migrations if drift is confirmed.
3. Run authenticated browser QA for each account composition and key workflows, including inventory/Chaos Sort/imports, save-to-zero, search, shares, billing, and provider failures.
4. Capture populated-workspace timing/query plans and confirm monitoring/error reporting.
5. Review and merge this audit branch only after the P0/P1 pending items have explicit owners and staging evidence.

## Release recommendation

**Recommended posture:** suitable for controlled staging/beta validation; not certified for unrestricted public launch until AUD-001 through AUD-006 are closed or explicitly accepted by the release owner.

No production Supabase migrations were applied. No production deployment was triggered. No live billing or customer data was changed.
