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
- Implemented: Root ESLint scope excludes confirmed historical Expo backups and generated output so active checks focus on the current web/mobile code.
- Partially Implemented: Backup folders remain in the repository for review; see `docs/REPOSITORY_CLEANUP_PLAN.md` before archiving or deleting them.

## Repository Structure

- Implemented: The active web application path is `src/`.
- Implemented: The active mobile application path is `mobile/`.
- Implemented: The active Supabase infrastructure path is `supabase/`.
- Implemented: `cloudflare/` contains active inbound email worker source.
- Historical Backup: `mobile_backup/`, `mobile-sdk54-clean-backup/`, and `mobile-sdk57-backup/` are retained snapshots and are excluded from active root lint traversal.
- Generated Output: `.next/`, `.cache/`, `dist/`, `coverage/`, `mobile/dist/`, `mobile/.expo/`, `node_modules/`, and `node_modules-install-failed/` are not product source.
- Planned: Archive or delete historical and generated folders only after the cleanup plan's import, workflow, and product-owner review gates pass.

## Design-System Architecture

- Implemented: Shared design tokens live in `mobile/design/shared-tokens.ts`, with a root re-export endpoint at `design-system/tokens.ts`.
- Implemented: Next.js consumes design-system tokens through `src/lib/design-system/tokens.ts`, CSS variables in `src/app/globals.css`, and web primitives in `src/components/design-system/td-primitives.tsx`.
- Implemented: Expo consumes the same token source through `mobile/design/tokens.ts` and React Native primitives in `mobile/components/design-system.tsx`.
- Implemented: Expo and Next.js have development-only design-system showcase routes.
- Partially Implemented: Existing legacy primitives remain in place for incremental migration.
- Planned: Navigation, modal, toast, chart, and table primitives are later focused architecture tasks.

## Navigation Architecture

- Implemented: Active mobile tabs are configured through `mobile/services/navigation-contract.ts` and rendered by the single Expo Router tab layout in `mobile/app/(tabs)/_layout.tsx`.
- Implemented: Mobile primary navigation is one safe-area-aware bottom bar with exactly five visible tabs per account composition. The old Expo template Explore placeholder has been removed from the active tab group.
- Implemented: Mobile route guards wait for auth restoration before evaluating protected admin access; unresolved local account state shows a loading fallback before tabs render.
- Implemented: Active web dashboard navigation uses `src/lib/navigation/contract.ts` for the canonical route contract and `src/components/dashboard/navigation.ts` as the icon/platform adapter for `TieredDashboardShell`.
- Implemented: Admin access is an additional protected destination. Mobile exposes `/admin` from the profile entry for role-bearing users, and web exposes `/dashboard/admin` for the owner; neither replaces the normal workspace shell.
- Partially Implemented: Mobile Seller and Store tab labels now match the canonical navigation contract, but some labels still point at existing workspace screens until dedicated route content is built in a future product sprint.
- Partially Implemented: Web has a canonical contract for Collector, Seller, Store, and Admin navigation, but destinations without dedicated pages are marked `planned` or mapped to current workspace shells rather than creating new product screens.
- Partially Implemented: Several older dashboard sidebars, topbars, mobile navs, and navigation definition files still exist for legacy components and should be deprecated only after import ownership is audited.

### Canonical Route Map

- Mobile Free/Collector: Home `/(tabs)`, Collection `/(tabs)/collection`, Scan `/(tabs)/scan`, Signals `/(tabs)/sell`, Profile `/(tabs)/profile`.
- Mobile Seller: Home `/(tabs)`, Collection `/(tabs)/collection`, Deal Desk `/(tabs)/deal-desk`, Signals `/(tabs)/sell`, Profile `/(tabs)/profile`.
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
- Inconsistent labels: prior mobile Seller/Store tabs used Collector-oriented or prototype labels; active mobile Seller now uses Collection and Store uses Business/Activity while unfinished destination content remains marked Partially Implemented.
- Account-type drift: active web and mobile code now use `free | collector | seller | store`; legacy `business` values are normalized to Store at runtime and remain as schema/document-key migration debt.
- Accessibility risks: older navigation components may lack `aria-current`, labels, or focus rings. The active sidebar and web mobile nav now set selected state and focus-visible styling; mobile tabs now set tab accessibility labels and selected state.
- Intentional mobile/web differences: mobile uses five bottom tabs optimized for touch and deep links; web uses a wider dashboard sidebar plus compact mobile web bottom nav.
- Migration order: active mobile tab layout, active web dashboard shell, docs/tests, then legacy dashboard import audit, then route content alignment.

### Mobile Bottom Navigation Rules

- Implemented: The account-aware tab mapping is Free/Collector `Home, Collection, Scan, Signals, Profile`; Seller `Home, Collection, Deal Desk, Signals, Profile`; Store `Home, Business, Deal Desk, Activity, Profile`.
- Implemented: Scan and Deal Desk are center actions and stay reachable through normal tab routes. Their visual treatment is restrained inside the same equal-width tab cell.
- Implemented: Admin access stays outside the primary tab bar and remains additive through protected profile/admin navigation.
- Implemented: Safe-area height and scroll inset helpers live in `mobile/services/navigation-contract.ts` so screens can keep content clear of the bar.
- Planned: Dedicated mobile content for Store Business/Activity and deeper Signals workflows remains future product work.

## Identity And Entitlement Architecture

- Implemented: Canonical shared access types live in `mobile/services/access-model.ts`, with the Next.js adapter re-export at `src/lib/identity/access-model.ts`.
- Implemented: Web server-side access resolution lives in `src/lib/identity/server-access.ts` and reads role, preferences, billing subscription, and membership override records.
- Implemented: Server guards for privileged web APIs live in `src/lib/identity/server-guards.ts`.
- Implemented: Mobile role context normalizes `user_roles.role` through the same platform-role vocabulary, but mobile remains client-side UX state.
- Implemented: Active web admin page, plan preview route, admin users API, marketplace integrations API, and trial invitation API no longer authorize from a hard-coded email.

## Storage Location Manager Architecture

- Implemented: Shared storage-location models and pure contract helpers live in `mobile/services/storage-location-manager.ts`, with the Next.js adapter at `src/lib/storage-location-manager.ts`.
- Implemented: Mobile uses `mobile/app/storage-locations.tsx` as a protected stack destination outside the primary tab bar. The Collection tab and card-detail route link to it without changing the canonical five-tab navigation.
- Implemented: Web renders `StorageLocationManager` inside the existing protected Collector Workspace route instead of adding a separate unguarded dashboard surface.
- Implemented: Both platforms use owner-scoped Supabase queries against `inventory_locations.user_id` and `inventory_items.user_id`.
- Partially Implemented: Location hierarchy is represented through `inventory_locations.data.parentId` because the active schema has no first-class parent column or database constraint.
- Partially Implemented: Recent, favorite, and archived metadata are represented in `inventory_locations.data` for this sprint. Database-enforced indexes/constraints require a reviewed migration proposal before production reliance.
- Planned: Scanner recognition, deck usage, marketplace listing, and portfolio analytics remain separate future integrations. The mobile manager exposes only a scan-to-location integration point.

## Trade Binder And Wishlist Architecture

- Implemented: Shared Trade Binder and Wishlist models live in `mobile/services/trade-binder-wishlist.ts`, with the Next.js adapter at `src/lib/trade-binder-wishlist.ts`.
- Implemented: Mobile route map: `/trade-binder` shows cards marked with trade statuses, and `/wishlist` shows wanted cards, priorities, and matches. Both are stack routes linked from Collection and do not change the canonical five-tab bar.
- Implemented: Web route map: `/dashboard/inventory` renders the Collector Workspace with an embedded Trade Binder/Wishlist panel for Binder, Wishlist, and Matches views.
- Implemented: Data comes from owner-scoped `inventory_items`, `inventory_locations`, `binder_card_trade_status`, and `collector_wishlist` queries.
- Implemented: Matching is strict for every specified wishlist field: card name must match, set code must match when present, condition must match when present, and finish must match when present. Unspecified set/condition/finish fields are flexible.
- Partially Implemented: Wishlist exact-printing matching cannot include collector number because `collector_wishlist` has no collector-number column.
- Partially Implemented: The experience is a personal planning workspace only. It does not create peer-to-peer trade offers, messaging, checkout, or live marketplace workflows.
- Planned: Future trade-calculator integration should consume `WishlistMatch` and `TradeBinderItem` rather than inventing a parallel matching contract.

## Scanner Architecture

- Implemented: Mobile scanner foundation lives in `mobile/app/(tabs)/scan.tsx`, `mobile/services/scanner-foundation.ts`, and `mobile/services/scanner-data.ts`.
- Implemented: The account-aware center Scan tab opens the dedicated scanner screen.
- Implemented: Scanner flow supports permission states, manual search, likely printing candidates, exact-printing selection, confirmation, Collection insert, optional storage assignment, optional Trade Binder status, optional Wishlist action, rapid reset, and interrupted draft persistence.
- Implemented: Scanner offline replay is centralized in `mobile/services/scanner-replay.ts` with an event bridge mounted in the root mobile frame. It replays queued scanner adds only for the active authenticated user on session restoration, app resume, Expo Web network reconnect, and manual retry.
- Implemented: Scanner queued adds use the generated inventory item id as part of a stable idempotency key. If a retry finds the item already written for the same user, replay treats the entry as synced instead of inserting a duplicate.
- Implemented: Scanner recovery UI lives at `/scanner-recovery` and supports inspecting exact queued scan details, retrying one, retrying all, and confirmed discard.
- Implemented: Recognition-provider interface is defined by `ScannerRecognitionProvider`. The active provider is an explicit unavailable-camera/manual-search foundation; it does not claim OCR accuracy.
- Partially Implemented: The mobile app does not currently include `expo-camera`, so capture/OCR is unavailable in Expo Go, Expo Web, and native builds until a camera dependency and permissions config are approved.
- Partially Implemented: Manual search uses Scryfall printings over the network and cached recent candidates when available offline.
- Partially Implemented: Native network reconnect detection is not a standalone trigger until an approved reachability dependency is added; app resume and session restore still retry queued scanner adds.
- Planned: Future OCR/image-recognition providers should implement the same provider interface and must require clear user intent before uploading images.
- Planned: Bluetooth, bulk hardware scanner, and Deal Desk ingestion should consume validated scanner confirmations rather than bypassing Collection, Storage, Trade Binder, and Wishlist contracts.
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

## Collector Workspace Architecture

- Implemented: Canonical Collector Workspace models and pure filtering/sorting/summary helpers live in `mobile/services/collector-workspace.ts`, with the Next.js adapter at `src/lib/collector-workspace.ts`.
- Implemented: Mobile Collection route `mobile/app/(tabs)/collection.tsx` uses the shared model, TD primitives, debounced search, sort controls, list/grid display, `FlatList` virtualization, image placeholders, loading/empty/no-results/error states, and stale-data messaging.
- Implemented: Mobile Card Detail route `mobile/app/collection/[cardId].tsx` loads a single saved inventory item by id and shows image, exact printing, condition, finish, quantity, storage, price unavailable state, and organization controls.
- Implemented: Web Collection route `/dashboard/inventory` now renders `src/components/dashboard/collector-workspace/CollectorWorkspace.tsx` with dense search, filters, sort, list/grid toggle, summary metrics, Free-plan limit messaging, and import/export entry points for Seller/Store entitlements.
- Implemented: Web Card Detail route `/dashboard/inventory/[cardId]` renders the same saved card facts through `CollectorCardDetail`.
- Implemented: Collection data loaders read existing `inventory_items`, `inventory_locations`, `binder_card_trade_status`, and `collector_wishlist` tables. Mobile caches the loaded page by authenticated user id for offline/stale browsing.
- Implemented: Collector organization mutation contracts live in `mobile/services/collector-mutations.ts`, with the Next.js adapter at `src/lib/collector-mutations.ts`.
- Implemented: Mobile and web card detail surfaces can update owned quantity, condition, finish, storage assignment, Trade Binder status, and Wishlist state with optimistic UI and rollback on failure.
- Implemented: Web organization writes go through `src/app/api/collector-workspace/mutations/route.ts`, which authenticates the user, scopes the inventory record by `user_id`, validates Free-plan card limits through the canonical membership contract, and then writes through authenticated Supabase/RLS.
- Partially Implemented: Native mobile writes use Supabase RLS for server-side ownership and queue failed/offline writes by user, but DB-side Free-plan enforcement for direct native writes still needs a reviewed RPC/trigger migration proposal before it can be called production-authoritative.
- Implemented: `supabase/migrations/202608050001_collector_mutation_security_proposal.sql` proposes a database trigger and RPC path to enforce inventory ownership and Free-plan 500 total-card quantity limits transactionally for mobile, web, and offline replay. It has not been applied.
- Partially Implemented: Price display uses positive saved inventory value/unit market value when present and says unavailable when missing or defaulted to zero. Live market pricing and price history are future integration work.
- Partially Implemented: Existing large inventory management components remain in the repository and should be migrated or retired only after a separate import/workflow review.

### Collector Route Map

- Mobile Collection: `/(tabs)/collection`.
- Mobile Card Detail: `/collection/[cardId]`.
- Mobile Scanner entry point: `/(tabs)/scan`.
- Mobile Portfolio/Signals entry point: `/(tabs)/sell` remains Partially Implemented until portfolio navigation receives a dedicated mobile destination.
- Web Collection: `/dashboard/inventory`.
- Web Card Detail: `/dashboard/inventory/[cardId]`.
- Web Decks entry point: `/dashboard/deck-vault`.
- Web Portfolio and Trade Binder entry point: `/dashboard/collector-portfolio`.
- Web Scanner entry point: `/dashboard/card-photo-scanner`.

### Collector Audit

- Existing collection functionality: web had a large inventory workspace with storage locations, card filing, Scryfall printing selection, marketplace listing metadata, and cloud persistence. Mobile had a static sample Collection screen.
- Active versus legacy implementations: the new Collector Workspace browser is active for web `/dashboard/inventory` and mobile `/(tabs)/collection`; older dashboard inventory components remain available but are no longer the route entry point.
- Current data sources: saved user inventory rows, storage-location rows, trade-status rows, and wishlist rows in Supabase. Mobile uses the same data when configured and a stale cache only after a successful prior load.
- Missing data contracts: deck usage relationships, scanner-recognition writes, portfolio analytics, trade transactions, marketplace listings, and normalized per-print market-price history are not yet canonical.
- Storage-location support: implemented as a preview from `inventory_locations` plus item payload `binderPage` and `binderSlot`; missing locations show an unavailable state.
- Image and pricing dependencies: card images come only from saved `imageUrl`; pricing comes only from saved `unitMarketValue` or inventory value divided by quantity. Scryfall lookup and live price history are not invoked by the browser.
- Performance risks: current browsers limit inventory reads to `COLLECTION_PAGE_SIZE` and debounce search, but server-side pagination cursors and virtualized web tables are future work for very large collections.
- Mobile/web responsibility differences: mobile prioritizes fast touch browsing, stale/offline visibility, card images, exact printings, and quick status scanning. Web prioritizes dense management, filters, bulk-selection foundation, storage visibility, and import/export navigation.
- Recommended migration order: stabilize organization mutations and offline replay, add explicit pagination cursors, propose DB-side native limit enforcement, wire scanner add-to-collection, then migrate or retire legacy inventory management surfaces.

### Collector Mutation Lifecycle

- Implemented: Optimistic updates clone the previous card list, apply the requested local change immediately, and restore the previous list if the write fails.
- Implemented: Quantity validation rejects negative and fractional values. Quantity zero is stored as zero owned and does not delete or archive the inventory row.
- Implemented: Trade Binder statuses are canonical: `not_for_trade`, `available`, `reserved`, `pending`, `looking_for_upgrade`, and `for_sale`; every status except `not_for_trade` remains visible in trade filters.
- Implemented: Storage assignment supports choosing an existing location or clearing the location. Nested binder-page editing remains outside this sprint.
- Partially Implemented: Mobile has a replay helper for queued collector mutations and replaces duplicate queued writes for the same user/card/action. Automatic network-triggered replay and conflict resolution beyond last queued write wins remain future sync work.
- Implemented: Mobile replay classifies proposed database-authoritative mutation errors and keeps failed queued writes with `errorCode`/`lastError` metadata.
- Implemented: Collector collection browsing now uses cursor-shaped page requests shared by mobile and web. Search and available filters are applied to the authenticated user's Supabase query before page retrieval, and pages merge by `inventory_items.id` to prevent duplicate cards.
- Implemented: Cursor shape is `sort|value|id`, URL-encoded by `encodeCollectionCursor`, with deterministic secondary ordering by `id`.
- Implemented: The shared page size is `COLLECTION_PAGE_SIZE = 100`, capped by `COLLECTION_MAX_PAGE_SIZE = 100`.
- Partially Implemented: Mobile and web show initial loading, loading-more, retry/error, stale/offline, and end-of-results states. Web table/grid still needs virtualization if production collections regularly exceed several thousand visible rows.
- Partially Implemented: Trade Binder and Wishlist filters are batched through related table lookups to avoid N+1 queries, but large related tables may need dedicated RPCs or indexed materialized access paths later.

### Collector Mutation Security Proposal

- Implemented: Current direct table ownership is user-scoped through `inventory_items.user_id`; no active workspace-owned inventory field exists.
- Implemented: The proposal uses `collector_effective_membership_tier(user_id)` to resolve explicit admin membership override first, then current paid billing, then Free fallback when profile/preferences exist.
- Implemented: Platform role is intentionally not part of the proposed card-limit bypass. Only paid billing or explicit membership override removes the Free limit.
- Implemented: The proposal adds trigger enforcement for direct table insert/update/delete plus `collector_mutate_inventory_item(jsonb)` as a preferred authoritative mutation path.
- Planned: Stage replay must verify impact on any service-role imports or legacy inventory tools before production application.

## Mobile Home Architecture

- Implemented: Mobile Home lives at `mobile/app/(tabs)/index.tsx` and uses the existing account-aware bottom tab architecture as the single primary navigation system.
- Implemented: Home composition rules live in `mobile/services/mobile-home.ts` so account-type copy, action routing, active-session visibility, and unavailable-state policy remain separate from presentation.
- Implemented: The Home information hierarchy is compact header, portfolio/collection pulse, smart action row, Today/Harbor briefing, real active-session resume card when present, and recent-activity empty state.
- Implemented: Home reads real collection summary data through the existing Collector Workspace loader and summarizes saved cards, known value, storage locations, and missing prices. It does not show mock portfolio values, mock charts, mock movement, or fake activity.
- Implemented: Free, Collector, Seller, and Store share one adaptable composition. Seller and Store route the trade action to Deal Desk; Free and Collector route it to the existing Signals/Trade surface.
- Partially Implemented: Market movement, recent activity feed, notification counts, and operations signals are unavailable states until backed by real data.
- Planned: Add native screenshots/manual QA coverage for small phone, large phone, iOS safe area, Android safe area, long text, no user data, populated user data, and offline/stale state.
