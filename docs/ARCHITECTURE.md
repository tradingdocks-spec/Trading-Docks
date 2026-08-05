# Architecture

## Web Architecture

- Implemented: Next.js 16.2.12, React 19.2.4, TypeScript, Tailwind CSS v4, App Router under `src/app`.
- Implemented: Root config files include `next.config.ts`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `proxy.ts`, and `src/proxy.ts`.
- Implemented: `src/app/layout.tsx` owns global metadata, viewport, global CSS, and navigation entrance effects.
- Implemented: `src/app/dashboard/layout.tsx` protects the dashboard server-side and renders `TieredDashboardShell`.
- Implemented: API route handlers live under `src/app/api`.
- Partially Implemented: There are multiple dashboard architecture generations under `src/components/dashboard`, `src/components/dashboard-v2`, and older layout folders.
- Partially Implemented: Some route handlers are intentionally public through proxy allowlists, while others rely on proxy/session checks; route-level authorization should be audited per endpoint.

## Mobile Architecture

- Implemented: Active mobile app lives in `mobile`.
- Implemented: Expo SDK 54, Expo Router 6, React Native 0.81, React 19.1.
- Implemented: Routes live in `mobile/app`, including root stack, tabs, auth, onboarding, settings, plans, admin, and experience screens.
- Implemented: Root mobile frame wires `AuthProvider`, `AdminProvider`, `AccountProvider`, `SessionProvider`, biometric gate, status bar, and stack navigation.
- Partially Implemented: Mobile account state is local-first and not yet aligned with web billing as the source of truth.
- Partially Implemented: Admin mobile APIs expect Supabase RPCs/tables that require migrations and production setup.

## Authentication Boundary

- Implemented: Web uses Supabase SSR with `@supabase/ssr`.
- Implemented: `src/proxy.ts` calls `updateSession` from `src/lib/supabase/proxy.ts`.
- Implemented: Dashboard and onboarding routes redirect anonymous users to sign-in.
- Implemented: Most API routes require authentication by default, with explicit public and provider callback/webhook exceptions.
- Implemented: Active web and mobile admin status resolves from `user_roles`; hard-coded email authorization has been removed from active web routes.

## Data Architecture

- Implemented: Supabase migration history covers profiles, workspaces, preferences, billing subscriptions, inventory, deck vault, marketplace connections, credentials, orders, buylist feeds, feedback, inbound email, collector portfolio, and public sharing.
- Implemented: RLS is enabled in migrations for many business tables.
- Partially Implemented: Several migrations recreate or repair the same objects, especially deck vault, marketplace sync runs, and inbound email. Staging replay must be verified.

## Integration Architecture

- Implemented: Stripe server helpers, checkout route, portal route, webhook route, and plan price mapping.
- Implemented: Membership product definitions and entitlements are centralized in `mobile/services/membership-catalog.ts`, with `src/lib/membership-catalog.ts` as the Next.js adapter.
- Implemented: Supabase service-role admin client exists for server-only operations.
- Implemented: Cloudflare inbound email worker scripts exist.
- Partially Implemented: eBay and Mana Pool integration surfaces exist but require provider credentials and production validation.
- Planned: RevenueCat is not installed in active root or mobile dependencies.

## Build and CI

- Implemented: Root scripts include `dev`, `build`, `lint`, `typecheck`, and `check`.
- Implemented: GitHub Actions `quality.yml` runs `npm ci`, `npm run check`, and `npm run build` on pull requests and pushes to main.
- Partially Implemented: Mobile has `expo lint` but no root CI job for mobile.
- Planned: No root unit/integration test script is configured.

## Design-System Architecture

- Implemented: Shared design tokens live in `mobile/design/shared-tokens.ts`, with a root re-export endpoint at `design-system/tokens.ts`.
- Implemented: Next.js consumes design-system tokens through `src/lib/design-system/tokens.ts`, CSS variables in `src/app/globals.css`, and web primitives in `src/components/design-system/td-primitives.tsx`.
- Implemented: Expo consumes the same token source through `mobile/design/tokens.ts` and React Native primitives in `mobile/components/design-system.tsx`.
- Implemented: Expo and Next.js have development-only design-system showcase routes.
- Partially Implemented: Existing legacy primitives remain in place for incremental migration.
- Planned: Navigation, modal, toast, chart, and table primitives are later focused architecture tasks.

## Navigation Architecture

- Implemented: Active mobile tabs are configured through `mobile/services/navigation-contract.ts` and rendered by the single Expo Router tab layout in `mobile/app/(tabs)/_layout.tsx`.
- Implemented: Mobile route guards wait for auth restoration before evaluating protected admin access; unresolved local account state shows a loading fallback before tabs render.
- Implemented: Active web dashboard navigation uses `src/lib/navigation/contract.ts` for the canonical route contract and `src/components/dashboard/navigation.ts` as the icon/platform adapter for `TieredDashboardShell`.
- Implemented: Admin access is an additional protected destination. Mobile exposes `/admin` from the profile entry for role-bearing users, and web exposes `/dashboard/admin` for the owner; neither replaces the normal workspace shell.
- Partially Implemented: Mobile Seller and Store tab labels now match the canonical navigation contract, but some labels still point at existing workspace screens until dedicated route content is built in a future product sprint.
- Partially Implemented: Web has a canonical contract for Collector, Seller, Store, and Admin navigation, but destinations without dedicated pages are marked `planned` or mapped to current workspace shells rather than creating new product screens.
- Partially Implemented: Several older dashboard sidebars, topbars, mobile navs, and navigation definition files still exist for legacy components and should be deprecated only after import ownership is audited.

### Canonical Route Map

- Mobile Free/Collector: Home `/(tabs)`, Collection `/(tabs)/collection`, Scan `/(tabs)/scan`, Signals `/(tabs)/sell`, Profile `/(tabs)/profile`.
- Mobile Seller: Home `/(tabs)`, Buying `/(tabs)/collection` (Partially Implemented), Deal Desk `/(tabs)/deal-desk`, Signals `/(tabs)/sell`, Profile `/(tabs)/profile`.
- Mobile Store: Home `/(tabs)`, Business `/(tabs)/collection` (Partially Implemented), Deal Desk `/(tabs)/deal-desk`, Activity `/(tabs)/sell` (Partially Implemented), Profile `/(tabs)/profile`.
- Mobile Admin: Command Center `/admin` remains protected and additive.
- Web Collector: Dashboard `/dashboard`, Collection `/dashboard/inventory`, Decks `/dashboard/deck-vault`, Trade Binder `/dashboard/collector-portfolio` (Planned dedicated route), Portfolio `/dashboard/collector-portfolio`, Settings `/dashboard/settings`.
- Web Seller: Dashboard `/dashboard`, Inventory `/dashboard/inventory`, Deal Desk `/dashboard/purchasing`, Buying Sessions `/dashboard/collection-buying`, Exports `/dashboard/tools/csv-converter`, Analytics `/dashboard/analytics`, Settings `/dashboard/settings`.
- Web Store: Dashboard `/dashboard`, Inventory `/dashboard/inventory`, Deal Desk `/dashboard/purchasing`, Employees `/dashboard/employees`, Customers `/dashboard/customers`, Operations `/dashboard/tasks`, Analytics `/dashboard/analytics`, Settings `/dashboard/settings`.
- Web Admin: Command Center `/dashboard/admin`; Users, Subscriptions, Sessions, System Health, Audit Log, Plans, and Feature Flags remain Partially Implemented or Planned inside the current admin surface.

### Navigation Audit

- Current route map: Expo Router owns `mobile/app` with public auth/onboarding/plans and protected tabs/admin stacks; Next.js App Router owns `src/app/dashboard` with a server-protected dashboard layout and owner-protected admin page.
- Duplicated navigation implementations: active mobile tabs, web `TieredSidebar`, web `MobileBottomNav`, older dashboard sidebars, `src/components/dashboard/navigation.ts`, `src/components/dashboard/navigation/navigation.ts`, and backup dashboard generations overlap.
- Route-guard timing risks: mobile auth restoration is gated at root, but account and admin lookups are asynchronous and need loading fallbacks; web dashboard guard is server-side, while owner/admin authority is still not unified with mobile roles.
- Inconsistent labels: prior mobile Seller/Store tabs used Collector-oriented labels such as Inventory/Signals; web had seller-heavy labels for every account tier.
- Account-type drift: active web and mobile code now use `free | collector | seller | store`; legacy `business` values are normalized to Store at runtime and remain as schema/document-key migration debt.
- Accessibility risks: older navigation components may lack `aria-current`, labels, or focus rings. The active sidebar and web mobile nav now set selected state and focus-visible styling; mobile tabs now set tab accessibility labels and selected state.
- Intentional mobile/web differences: mobile uses five bottom tabs optimized for touch and deep links; web uses a wider dashboard sidebar plus compact mobile web bottom nav.
- Migration order: active mobile tab layout, active web dashboard shell, docs/tests, then legacy dashboard import audit, then route content alignment.

## Identity And Entitlement Architecture

- Implemented: Canonical shared access types live in `mobile/services/access-model.ts`, with the Next.js adapter re-export at `src/lib/identity/access-model.ts`.
- Implemented: Web server-side access resolution lives in `src/lib/identity/server-access.ts` and reads role, preferences, billing subscription, and membership override records.
- Implemented: Server guards for privileged web APIs live in `src/lib/identity/server-guards.ts`.
- Implemented: Mobile role context normalizes `user_roles.role` through the same platform-role vocabulary, but mobile remains client-side UX state.
- Implemented: Active web admin page, plan preview route, admin users API, marketplace integrations API, and trial invitation API no longer authorize from a hard-coded email.
- Implemented: Membership tier, account type, billing status, platform role, and resolved entitlement keys are separate typed concepts.
- Implemented: Provider identifiers for Stripe and planned RevenueCat live outside the product plan definitions.
- Partially Implemented: Legacy web admin component variants still use older owner wording but are not the active import path.
- Partially Implemented: Database migrations still include older email-owner helper functions and should be replaced in a dedicated migration task.

## Membership And Entitlement Architecture

- Implemented: Canonical plan ids are `free`, `collector`, `seller`, and `store`.
- Implemented: Active web pricing pages, checkout payloads, Stripe plan mapping, mobile plan cards, route gates, dashboard shells, and admin override UI consume the canonical catalog or adapter.
- Implemented: Store employee-account entitlement exists, but employee-account capacity is represented as pending configuration rather than a hard-coded seat count.
- Requires Production Configuration: Stripe price IDs must be verified against the canonical prices before live checkout.
- Planned: RevenueCat provider mappings exist as planned records only; mobile billing is not active.
- Planned: Create a reviewed Supabase migration to replace `business` membership values and constraints with `store`.
