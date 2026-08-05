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
- Partially Implemented: Owner/admin status is partly hard-coded by email on web and role-table based on mobile.

## Data Architecture

- Implemented: Supabase migration history covers profiles, workspaces, preferences, billing subscriptions, inventory, deck vault, marketplace connections, credentials, orders, buylist feeds, feedback, inbound email, collector portfolio, and public sharing.
- Implemented: RLS is enabled in migrations for many business tables.
- Partially Implemented: Several migrations recreate or repair the same objects, especially deck vault, marketplace sync runs, and inbound email. Staging replay must be verified.

## Integration Architecture

- Implemented: Stripe server helpers, checkout route, portal route, webhook route, and plan price mapping.
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
