# Trading Docks OS Product Bible

Trading Docks OS is currently a trading-card operating system for collectors, sellers, and stores. The active web app is a premium SaaS workspace built on Next.js; the active mobile app is an Expo companion focused on collection, scanning, buying/selling signals, account plans, sessions, and admin command-center work.

## Product Pillars

- Implemented: Public landing, pricing, privacy, terms, and security pages.
- Implemented: Authenticated dashboard shell with plan-aware navigation.
- Implemented: Collector inventory, deck vault, portfolio sharing, public binder/portfolio pages, CSV tooling, feedback, settings, and plan comparison surfaces.
- Partially Implemented: Seller workflows including purchasing intelligence, collection buying, sealed/precon buying, bulk buying, buylist intelligence, card shows, marketplaces, orders, analytics, automation, and seller mission control.
- Partially Implemented: Store operations including customers, employees, payroll, reports, calendar, vendors, supplies, tasks, tournaments, finances, and organization.
- Requires Production Configuration: Billing, marketplace integrations, inbound email, webhooks, external card data APIs, and production Supabase state.

## Audience

- Implemented: Free and collector users can access core dashboard, inventory, deck vault, plans, feedback, settings, and public collector sharing.
- Partially Implemented: Sellers can access buying, selling, marketplace, orders, CRM, and automation surfaces, but several workflows depend on provider configuration and data completeness.
- Partially Implemented: Store/business users can access operational screens, but some screens are workspace CRUD shells or early implementations rather than finished operating workflows.

## Feature Status Map

| Area | Status | Current Evidence |
| --- | --- | --- |
| Landing and pricing | Implemented | `src/app/page.tsx`, `src/app/pricing/page.tsx`, landing components |
| Web auth | Implemented | Supabase SSR clients, auth server actions, callback route, proxy protection |
| Dashboard shell | Implemented | `src/app/dashboard/layout.tsx`, `TieredDashboardShell`, `TieredSidebar` |
| Plan gates | Partially Implemented | `PlanAccessGate`, `tier-access.ts`; server-side enforcement is inconsistent across pages/API intent |
| Stripe billing | Requires Production Configuration | Checkout, portal, webhook routes exist; secrets and live webhooks required |
| RevenueCat | Planned | Mentioned in mobile setup notes only; no active dependency found |
| Supabase data persistence | Partially Implemented | Broad migrations and RLS exist; repeated repair migrations imply drift risk |
| Inventory | Partially Implemented | Web UI and migrations exist; production data isolation still requires verification |
| Deck Vault | Partially Implemented | Multiple persistence models and repair notes exist; active alias points to tiered deck vault |
| Collector portfolio and public shares | Partially Implemented | Routes and migrations exist; public share security was recently hardened |
| Marketplace integrations | Requires Production Configuration | eBay, Mana Pool, email import surfaces exist; credentials and provider flows required |
| Orders | Partially Implemented | Universal orders routes and components exist; provider ingestion requires live setup |
| Cloudflare inbound email | Requires Production Configuration | Worker scripts and migrations exist; DNS/routing/provider validation required |
| Mobile app | Partially Implemented | Expo Router app exists with auth, tabs, local sessions, plans, admin stubs |
| Offline sync | Partially Implemented | Mobile local queue exists; replay/conflict sync not implemented |
| Testing | Planned | No unit/integration test script found in root package |

## Product Truths

- The product surface is broad for the current repository maturity.
- The active web platform is ahead of the mobile platform in billing, dashboard breadth, and integration surface.
- The mobile app is not yet a RevenueCat-backed subscription authority.
- The current repo is foundation-heavy but needs consolidation before new features.
