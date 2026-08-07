# Trading Docks Platform Architecture

Status: Partially Implemented

This document maps the current Trading Docks web, mobile, Supabase, billing, and authority layers. It describes the repository as it exists on this branch and does not mark planned work as complete.

## Active Applications

| Surface | Path | Status | Current responsibility |
| --- | --- | --- | --- |
| Web app | `src/` | Implemented | Next.js dashboard, marketing/auth pages, billing APIs, server-side protected routes, admin surfaces. |
| Mobile app | `mobile/` | Implemented | Expo Router app, authenticated workspace tabs, scanner, collection tools, offline UX scaffolding. |
| Supabase infrastructure | `supabase/` | Partially Implemented | Historical migrations, RLS policies, billing reconciliation tables, proposal migrations. |
| Documentation | `docs/` | Partially Implemented | Product, architecture, security, membership, scanner, and repository health records. |
| Historical backups | `mobile_backup/`, `mobile-sdk54-clean-backup/`, `mobile-sdk57-backup/` | Historical backup | Not active app paths. They should not drive product decisions or tooling results. |

## Canonical Authority Layers

| Concept | Canonical authority | Status | Notes |
| --- | --- | --- | --- |
| Auth identity | Supabase Auth user UUID | Implemented | Web and mobile must treat the Supabase user id as the identity key. |
| Platform role | `user_roles` | Partially Implemented | Active code reads roles from Supabase. Historical migrations still include email-based owner helpers. |
| Account type | User preference/profile/workspace context | Partially Implemented | Account type controls workspace composition. It must not grant paid entitlements by itself. |
| Membership tier | `mobile/services/membership-catalog.ts` contract plus server billing state | Partially Implemented | Catalog defines tiers and entitlements. Server billing state determines the effective paid tier. |
| Billing state | Server-side Stripe/RevenueCat reconciliation tables | Partially Implemented | Stripe is active. RevenueCat webhook exists server-side and requires production configuration. |
| Entitlements | Canonical membership catalog resolved by access functions | Partially Implemented | Role, account type, and billing are kept separate before entitlements are resolved. |

## Web Architecture

Status: Partially Implemented

- Next.js app routes live under `src/app`.
- Server-side Supabase access uses server helpers and service-role access only in trusted server contexts.
- Dashboard route protection is enforced through middleware/proxy and server access helpers.
- Billing APIs are server-side only.
- Admin routes are intended to use `user_roles` authority, but historical Supabase functions still include email-based owner assumptions.

## Mobile Architecture

Status: Partially Implemented

- Expo Router routes live under `mobile/app`.
- Mobile tab navigation is account-aware and uses five primary tabs per account composition.
- Mobile Supabase access uses only `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Mobile RevenueCat SDK initialization uses the Supabase UUID as the app user id.
- Mobile may cache resolved access for UX, but privileged authorization must remain server-side.

## Workspace Model

Status: Partially Implemented

| Workspace | Status | Notes |
| --- | --- | --- |
| Collector | Partially Implemented | Collection, decks, trade binder, portfolio concepts exist in web/mobile with uneven completion. |
| Seller | Partially Implemented | Deal Desk and buying-session concepts exist; web/mobile behavior is not fully unified. |
| Store | Partially Implemented | Store is the canonical internal identifier. Business may appear as copy or legacy alias only. |
| Headquarters/Admin | Partially Implemented | Admin access is additive. It must not replace the user's normal workspace unless explicitly selected. |

## Key Architecture Gaps

| Gap | Severity | Status |
| --- | --- | --- |
| Historical Supabase owner helpers still rely on `tradingdocks@gmail.com`. | P1 | Requires migration plan. |
| Stripe and RevenueCat use different reconciliation paths. | P1 | Requires provider parity hardening. |
| Web has duplicate dashboard/product surfaces. | P1 | Requires staged web consolidation. |
| RLS does not yet apply the proposal enforcing Free total-card limits at the database layer. | P0/P1 depending on production write paths | Migration proposal exists; production application requires approval. |
| Mobile and web data parity is documented but not uniformly enforced by shared APIs. | P1 | Requires implementation refactor. |

## Recommended First Implementation Refactor

Status: Planned

Create one server-side access and entitlement package consumed by web route guards, API routes, Stripe reconciliation, RevenueCat reconciliation, and admin checks. Mobile should consume a client-safe adapter from the same type contract but never become the authority for privileged operations.
