# Web Product Audit

Status: Partially Implemented

This audit records product and architecture findings for the current web application. It is intentionally not a redesign plan.

## Current Web Surface

| Area | Status | Findings |
| --- | --- | --- |
| Public marketing/home | Partially Implemented | Public copy includes demo-style operational metrics and should be reviewed before broader launch. |
| Auth pages | Implemented | Sign-in/sign-up flows exist and depend on Supabase environment configuration. |
| Pricing | Partially Implemented | Must remain aligned with canonical membership catalog and provider mappings. |
| Dashboard shell | Partially Implemented | Many route families exist with overlapping product concepts. |
| Inventory/collection | Partially Implemented | Core surfaces exist; data parity with mobile remains incomplete. |
| Deal Desk/buying | Partially Implemented | Several seller buying routes exist and should be consolidated into a canonical workspace map. |
| Store operations | Partially Implemented | Employees, customers, organization, reports, finances, and operations routes exist with uneven completion. |
| Admin | Partially Implemented | Command Center exists but sub-routes are not fully separated. |

## Duplicate Web Systems

| Duplication | Status | Risk |
| --- | --- | --- |
| Dashboard navigation labels versus route guards | Active but duplicated | Labels and authority can drift. |
| Product plan cards versus membership catalog | Active but duplicated risk | Pricing/entitlements must consume canonical definitions. |
| Buying route families | Active but duplicated | Deal Desk, purchasing, collection buying, bulk buying, sealed buying, rules, recommendations, and history overlap. |
| Inventory terminology | Active but duplicated | Collection/inventory labels differ by mobile/web context. |
| Admin route presentation | Partially Implemented | Many admin nav entries collapse to a single route. |

## Production Readiness Risks

| Risk | Severity | Notes |
| --- | --- | --- |
| Public web content may overstate readiness. | P1 | Review claims, metrics, and unsupported workflows. |
| Route access matrix is incomplete for every dashboard route. | P1 | Add route registry enforcement before adding more web product. |
| Billing provider parity remains incomplete. | P1 | Stripe and RevenueCat should converge on one server resolution path. |
| Admin role model still has legacy database email assumptions. | P1 | Requires SQL migration plan. |

## Recommended Web Refactor Order

Status: Planned

1. Centralize route registry, labels, minimum tier, account type, and role requirements.
2. Move pricing/product display to canonical membership adapters.
3. Consolidate buying/Deal Desk route families.
4. Separate Headquarters/admin product routes from user dashboard routes while keeping access additive.
5. Replace demo/public claims with production-reviewed copy.
