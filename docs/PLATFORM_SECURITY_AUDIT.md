# Platform Security Audit

Status: Partially Implemented

This document records current high-risk security findings from the repository and platform audit.

## Implemented Controls

| Control | Status | Notes |
| --- | --- | --- |
| Mobile public Supabase config validation | Implemented | Mobile requires public URL and anon key and rejects secret-looking keys. |
| Web server Supabase admin separation | Implemented | Service-role use is confined to server contexts. |
| RevenueCat webhook route authentication | Implemented | Route verifies an authorization secret and uses constant-time comparison. |
| Dashboard session guard | Partially Implemented | Middleware/proxy guards dashboard routes and redirects unauthenticated users. |
| API auth defaults | Partially Implemented | Non-exempt API routes are rejected before app code; webhook routes rely on route-local verification. |

## P0 Findings

| Finding | Status | Required action |
| --- | --- | --- |
| Direct inventory writes need database-enforced Free limit before relying on client/mobile/offline mutation paths. | Requires Production Configuration | Review and apply the forward-only migration proposal in staging, then production. |
| Production secrets must never be exposed through mobile or browser bundles. | Implemented with ongoing risk | Continue source-contract and build audits for `service_role`, `sb_secret`, and secret-looking public keys. |

## P1 Findings

| Finding | Status | Required action |
| --- | --- | --- |
| Historical email-based admin helpers remain in Supabase migrations. | Legacy risk | Migrate to `user_roles` authority with forward-only SQL. |
| Public web copy includes product/demo claims that may not match production readiness. | Product/security trust risk | Replace with production-reviewed copy before broad launch. |
| Share token routes need continued privacy review. | Partially Implemented | Confirm no private user metadata leaks through token access. |
| Manual membership overrides need operational audit logging. | Planned | Override behavior is explicit but should become auditable. |

## Server Versus Client Responsibilities

Status: Partially Implemented

| Responsibility | Server | Client |
| --- | --- | --- |
| Auth identity validation | Authoritative | Reads session for UX. |
| Admin authorization | Authoritative through `user_roles` | May display admin entry if resolved access includes it. |
| Paid entitlement grants | Authoritative through billing reconciliation | May display cached current tier. |
| Inventory ownership enforcement | Authoritative through RLS/RPC/API | May optimistically update and queue writes. |
| Scanner image handling | Receives no images by default | Keeps captures/crops in memory unless user explicitly acts. |

## Access Authority Refactor

Status: Partially Implemented

The first reusable server-side route and API guards now live in `src/lib/platform/server-access.ts`. API capability decisions return `401` for unauthenticated callers and `403` for authenticated callers without capability access.

The client-safe adapter intentionally omits server-only provider detail and is not authorization.

## Production Security Gate

Status: Planned

Before public launch, confirm:

- Vercel production env contains only server-safe secrets.
- EAS preview/production env contains only Expo public mobile keys.
- RevenueCat webhook authentication succeeds with exact configured value.
- Supabase RLS policies match the intended production schema.
- No email-only admin authorization remains in active authorization paths.
