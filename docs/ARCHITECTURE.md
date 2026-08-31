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
- Implemented: The root launch gate now renders a branded startup state while auth restores, then routes to the authenticated workspace or Welcome without showing a transient login screen.
- Implemented: Legacy `/experience` demo content redirects to the active tabs route so fake portfolio values are not exposed as a production surface.
- Partially Implemented: `/plans` displays the canonical membership catalog but does not process paid mobile subscriptions.
- Partially Implemented: Mobile account state is local-first and not yet aligned with web billing as the source of truth.
- Partially Implemented: Admin mobile APIs expect Supabase RPCs/tables that require migrations and production setup.
- Partially Implemented: Mobile/web data parity is documented in `docs/MOBILE_WEB_DATA_PARITY.md`. Collection, storage, Trade Binder, and Wishlist use shared Supabase tables; scanner intake remains local-first until Review List finalization writes collection records through the canonical backend path.

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
- Implemented: Active mobile Collection reads canonical `inventory_items`, `inventory_locations`, `binder_card_trade_status`, and `collector_wishlist` rows scoped by the authenticated Supabase user.
- Partially Implemented: Mobile workspace/team data still needs a server-authoritative active workspace resolver before Store shared-inventory workflows are considered complete.
- Implemented: Inventory changes now have an append-only event ledger through `inventory_events` and the trusted RPCs `apply_collector_inventory_mutation` and `create_inventory_item_with_event`. New inventory creation paths should use those RPCs so quantity, location, condition, finish, cost basis, and source linkage are recorded consistently.
- Partially Implemented: Collection Intake / Buy Calculator is modeled as a server-backed acquisition workflow under `/dashboard/collection-buying` with `collection_intakes`, `collection_intake_items`, and `collection_purchases`. Drafts preserve exact printing, condition, finish, language, quantity, review status, and pricing data. Completion is designed to allocate acquisition cost proportionally by market value, create canonical `inventory_items`, and write `collection_purchase` inventory events. Local Supabase execution could not be validated on the current workstation because Docker/Podman/psql are unavailable; migration application and RPC/RLS behavior still require staging Supabase validation before production.
- Implemented: Collection Intake valuation separates market value, expected gross realization, selling costs, desired profit, calculated max offer, user offer, expected profit, ROI, margin, pricing coverage, value tiers, and review blockers. Ambiguous identity/printing, unknown condition/finish, and high-value confirmation block completion; missing prices are warnings and are not promoted to expensive-printing assumptions.

## Integration Architecture

- Implemented: Stripe server helpers, checkout route, portal route, webhook route, and plan price mapping.
- Implemented: Membership product definitions and entitlements are centralized in `mobile/services/membership-catalog.ts`, with `src/lib/membership-catalog.ts` as the Next.js adapter.
- Implemented: Supabase service-role admin client exists for server-only operations.
- Implemented: Cloudflare inbound email worker scripts exist.
- Partially Implemented: eBay and Mana Pool integration surfaces exist but require provider credentials and production validation.
- Implemented: RevenueCat is installed in the active mobile app and mobile purchase/restore entry points use Supabase user UUID as the RevenueCat appUserID.
- Partially Implemented: Server-side RevenueCat reconciliation lives at `/api/webhooks/revenuecat`, stores provider state in Supabase, and updates the canonical effective billing row; staging migration replay and Sandbox QA remain required before paid access release.
- Implemented: Mobile release environment rules live in `docs/MOBILE_PRODUCTION_ENV.md` and `mobile/services/mobile-release-config.ts`; `mobile/scripts/verify-production-release.js` validates production identifiers, forbidden public secrets, development flags, version/build metadata, and EAS profile presence.
- Partially Implemented: The first mobile RC billing strategy is Free-only native account creation with display-only paid entitlement state. Paid mobile upgrades remain Planned until StoreKit/Google Play Billing and backend entitlement reconciliation are approved.

## Build and CI

- Implemented: Root scripts include `dev`, `build`, `lint`, `typecheck`, and `check`.
- Implemented: GitHub Actions `quality.yml` runs `npm ci`, `npm run check`, and `npm run build` on pull requests and pushes to main.
- Partially Implemented: Mobile has `expo lint` but no root CI job for mobile.
- Planned: No root unit/integration test script is configured.
- Implemented: Root ESLint scope excludes confirmed historical Expo backups and generated output so active checks focus on the current web/mobile code.
- Partially Implemented: Backup folders remain in the repository for review; see `docs/REPOSITORY_CLEANUP_PLAN.md` before archiving or deleting them.
- Implemented: Mobile now has `npm run verify:production-release` for release-readiness checks; CI still needs a mobile job that runs it with production-style public environment values.

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
- Implemented: Mobile product design OS primitives now include `TDChip`, `TDMetricTile`, `TDIconRow`, `TDIconButton`, `TDListRow`, `TDSheet`, `TDSegmentedControl`, `TDResultTray`, `TDSkeleton`, `TDToast`, `TDStatusIndicator`, `TDNavigationHeader`, `TDScannerGuide`, and `TDSessionStrip` so active screens share selectable controls, summary metrics, icon rows, focus states, status feedback, scanner/session panels, and touch-target behavior.
- Implemented: Active mobile typography no longer uses negative letter spacing in the Expo token adapter.
- Implemented: `mobile/design/component-model.ts` documents canonical mobile surface levels, spacing scale, icon sizes, and primitive contract names for tests and future migration reviews.
- Partially Implemented: Existing legacy primitives remain in place for incremental migration.
- Planned: Dense chart/table primitives and a higher-level navigation wrapper are later focused architecture tasks.

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

- Mobile Free/Collector: Home `/(tabs)`, Collection `/(tabs)/collection`, Scan `/(tabs)/scan`, Intelligence `/(tabs)/sell`, Account `/(tabs)/profile`.
- Mobile Seller: Home `/(tabs)`, Collection `/(tabs)/collection`, Scan `/(tabs)/scan`, Intelligence `/(tabs)/sell`, Account `/(tabs)/profile`.
- Mobile Store: Home `/(tabs)`, Collection `/(tabs)/collection`, Scan `/(tabs)/scan`, Intelligence `/(tabs)/sell`, Account `/(tabs)/profile`.
- Mobile Deal Desk: `/deal-desk` remains a contextual secondary route and is not part of the bottom tab bar.
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

- Implemented: The account-aware tab mapping is now the same five primary destinations for Free, Collector, Seller, Store, and role-bearing users: `Home, Collection, Scan, Intelligence, Account`.
- Implemented: Scan remains the center action inside the same equal-width tab footprint. Deal Desk is contextual and no longer consumes primary navigation space.
- Implemented: Admin access stays outside the primary tab bar and remains additive through protected profile/admin navigation.
- Implemented: Safe-area height and scroll inset helpers live in `mobile/services/navigation-contract.ts` so screens can keep content clear of the bar.
- Planned: Dedicated mobile content for deeper Inventory Intelligence workflows remains future product work.

## Mobile Product Polish Architecture

- Implemented: Active mobile Collection, Card Detail, Storage Locations, Trade Binder, Wishlist, Scanner, Scanner Session Review, and Profile screens use the shared TD chip/metric/row primitives where practical.
- Implemented: This branch adds the mobile design OS documentation set, a current-state audit, design bible, component/accessibility/motion standards, and a staged migration plan before broad route redesign.
- Implemented: Active Inventory Intelligence and contextual Deal Desk routes now use TD primitive composition, preserve session routing, and remove unsupported fake business metrics from authenticated surfaces.
- Implemented: The mobile bottom navigation visual model is centralized in `mobile/services/navigation-contract.ts`, including safe-area height, 22 px icon sizing, equal-width cells, and restrained center-action geometry.
- Implemented: Mobile polish keeps authentication logic, billing, membership, Supabase schemas, scanner recognition providers, and desktop web routes unchanged.
- Implemented: Mobile screens continue to use the single account-aware bottom tab system and stack destinations for secondary flows.
- Partially Implemented: Broad route visual redesign remains incremental. The audit records Home, Collection, Card Detail, Storage, Trade Binder, Wishlist, Scanner, Session Review, Profile, Auth, Plans, Admin, and dev-only screen status without claiming release-complete polish.
- Partially Implemented: Authentication remains visually custom but keeps TD inputs, TD buttons, error state, loading state, remembered-email, magic-link, Google, and Apple entry points.
- Partially Implemented: Native responsive and accessibility QA still requires device/simulator review for small iPhone, large iPhone, Android, tablet, larger text, and narrow Expo Web.
- Planned: Future polish should target onboarding/plans/welcome, deeper Collector surfaces, admin surfaces, and dev-only tools after their product responsibilities are reviewed.

## Mobile Inventory Operating System Update

Status: Partially Implemented

- Implemented: Mobile V1 product responsibility is documented as scan, identify, locate, manage collection records, and view/build/share physical binders. Headquarters remains the home for deep seller/store operations.
- Implemented: Deal Desk was removed from primary mobile tab registration and retained only as a contextual secondary route.
- Implemented: Collection search now includes user-scoped storage-location matches in addition to card name, set, and collector number.
- Implemented: Shared physical-binder contracts now exist for mobile and web so future UI work does not create a mobile-only binder model.
- Implemented: Automatic Scan's current-frame trigger can fire before same-card removal state blocks rearm, preserving duplicate protection for the next card.
- Implemented: Physical binder UI, public binder share creation/revocation, scan destination selection, Card Show percentage mode, Home visual art-piece treatment, and scanner benchmark export are now present in Mobile V1.
- Requires Production Configuration: Measured scanner latency/FPS still require physical iOS/Android benchmark runs.

## Identity And Entitlement Architecture

- Implemented: Canonical shared access types live in `mobile/services/access-model.ts`, with the Next.js adapter re-export at `src/lib/identity/access-model.ts`.
- Implemented: Web server-side access resolution lives in `src/lib/identity/server-access.ts` and reads role, preferences, billing subscription, and membership override records.
- Implemented: RevenueCat provider reconciliation is server-only. Mobile never promotes canonical membership directly after purchase or restore.
- Implemented: Server guards for privileged web APIs live in `src/lib/identity/server-guards.ts`.
- Implemented: Mobile role context normalizes `user_roles.role` through the same platform-role vocabulary, but mobile remains client-side UX state.
- Implemented: Active web admin page, plan preview route, admin users API, marketplace integrations API, and trial invitation API no longer authorize from a hard-coded email.

## Storage Location Manager Architecture

- Implemented: Shared storage-location models and pure contract helpers live in `mobile/services/storage-location-manager.ts`, with the Next.js adapter at `src/lib/storage-location-manager.ts`.
- Implemented: Mobile uses `mobile/app/storage-locations.tsx` as a protected stack destination outside the primary tab bar. The Collection tab and card-detail route link to it without changing the canonical five-tab navigation.
- Implemented: Web renders `StorageLocationManager` inside the existing protected Collector Workspace route instead of adding a separate unguarded dashboard surface.
- Implemented: Both platforms use owner-scoped Supabase queries against `inventory_locations.user_id` and `inventory_items.user_id`.
- Partially Implemented: Location hierarchy is represented through `inventory_locations.data.parentId` because the active schema has no first-class parent column or database constraint. Mobile can create child locations and render breadcrumbs; database enforcement remains proposed work.
- Partially Implemented: Recent, favorite, and archived metadata are represented in `inventory_locations.data` for this sprint. Database-enforced indexes/constraints require a reviewed migration proposal before production reliance.
- Planned: Physical location is now a core Collection authority, not optional metadata. Collection, search, CSV import, Card Workspace, Trade Binder, and Storage must expose exact lot/location breakdowns for every owned copy; see `docs/COLLECTION_LOCATION_AUTHORITY.md`.
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
- Implemented: SDK-compatible `expo-camera` is installed and configured with camera permission copy. The scanner screen has guided local capture, torch, retake, and still-capture states.
- Implemented: Multi-signal scanner architecture contracts live in `mobile/services/scanner-intelligence.ts`; see `docs/SCANNER_ARCHITECTURE.md`.
- Implemented: Multi-TCG scanner architecture contracts live in `mobile/services/multi-tcg-scanner.ts`, adding game detection, Magic/Pokemon/One Piece/Lorcana adapters, mixed sessions, universal exports, and unsupported-card observations.
- Implemented: Scanner benchmark fixture and metrics contracts exist; see `docs/SCANNER_BENCHMARK.md`.
- Implemented: Scanner offline replay is centralized in `mobile/services/scanner-replay.ts` with an event bridge mounted in the root mobile frame. It replays queued scanner adds only for the active authenticated user on session restoration, app resume, Expo Web network reconnect, and manual retry.
- Implemented: Scanner queued adds use the generated inventory item id as part of a stable idempotency key. If a retry finds the item already written for the same user, replay treats the entry as synced instead of inserting a duplicate.
- Implemented: Scanner recovery UI lives at `/scanner-recovery` and supports inspecting exact queued scan details, retrying one, retrying all, and confirmed discard.
- Implemented: Mobile production dev tooling gates redirect `/dev/design-system`, `/dev/camera-qa`, and `/dev/scanner-benchmark` when their explicit development flags are disabled or when `NODE_ENV=production`.
- Implemented: Mobile root stack exposes a production-safe error boundary and a branded not-found fallback without leaking stack traces, provider details, or secret-bearing messages to customers.
- Implemented: Recognition-provider interface is defined by `ScannerRecognitionProvider`. The active provider is an explicit unavailable-camera/manual-search foundation; it does not claim OCR accuracy.
- Partially Implemented: Camera capture is enabled, but OCR, artwork matching, set-symbol recognition, collector-info cropping, and finish detection remain provider contracts until benchmarked implementations are added.
- Partially Implemented: Active inventory writes remain Magic-compatible. Multi-TCG candidates are modeled but not yet persisted through a universal inventory schema.
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
- Planned: Collection and Card Workspace must show physical-location lots, not just aggregate `quantityOwned`. Multi-location ownership, unassigned inventory, and partial-quantity moves are acceptance requirements for the next Collection/CSV/Storage implementation checkpoint.
- Partially Implemented: Price display uses positive saved inventory value/unit market value when present and says unavailable when missing or defaulted to zero. Live market pricing and price history are future integration work.
- Partially Implemented: Existing large inventory management components remain in the repository and should be migrated or retired only after a separate import/workflow review.

### Collector Route Map

- Mobile Collection: `/(tabs)/collection`.
- Mobile Card Detail: `/collection/[cardId]`.
- Mobile Scanner entry point: `/(tabs)/scan`.
- Mobile Inventory Intelligence entry point: `/(tabs)/sell` remains Partially Implemented until deeper inventory-health navigation receives dedicated mobile destinations.
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
- Implemented: Free, Collector, Seller, and Store share one adaptable Home composition. Seller and Store route session review to the scanner session list; Deal Desk remains contextual rather than primary navigation.
- Partially Implemented: Market movement, recent activity feed, notification counts, and operations signals are unavailable states until backed by real data.
- Planned: Add native screenshots/manual QA coverage for small phone, large phone, iOS safe area, Android safe area, long text, no user data, populated user data, and offline/stale state.

## Web Command Center Architecture

- Implemented: `/dashboard` resolves platform access through `resolvePlatformAccessForUser`. Seller, Store, Owner, and Admin accounts use the server-loaded Business Command Center; Free and Collector accounts use the personal command surface.
- Implemented: The personal command surface consumes the shared Inventory Attention model in `src/lib/inventory/intelligence.ts` through the adapter in `src/lib/dashboard/personal-command-center.ts`. It filters by `user_id`, does not read from localStorage, and uses database-level issue counts with bounded representative examples.
- Implemented: Personal command metrics and next actions are derived from real inventory attention groups: known market value coverage, storage coverage, missing prices, unknown condition/finish, and empty-account onboarding. Empty accounts do not receive fabricated activity, fake value, or fake signals.
- Partially Implemented: The personal dashboard does not yet have historical collection movement, recent activity, or cross-surface opportunity scoring. Those should remain unavailable/empty until backed by persisted events or explicit server summaries.

## Inventory Attention And Inbox Architecture

- Implemented: `src/lib/inventory/intelligence.ts` owns the first reusable Inventory Attention domain model. `InventoryAttentionItem` and `InventoryAttentionGroup` use typed issue identifiers instead of arbitrary strings and carry severity, reason, source, recommended action, action URL, affected inventory id, quantity, value, and representative metadata where available.
- Implemented: The current attention types are deliberately limited to rules Trading Docks can calculate truthfully from `inventory_items`: `missing_price`, `missing_cost_basis`, `missing_storage_location`, `unknown_condition`, `unknown_finish`, and `inventory_setup_required`.
- Implemented: Severity is deterministic: missing price is `high` because it blocks valuation and selling quality; missing storage, unknown condition, and unknown finish are `medium` because they weaken organization, trade matching, exports, and exact-pricing accuracy; empty setup is `low`.
- Implemented: The shared loader performs server-side, authenticated, user-scoped reads. It queries exact database counts for the current issue groups and separately loads a bounded recent sample ordered by `updated_at`, filtered by `user_id`. The first sample bound is `INVENTORY_ATTENTION_SAMPLE_SIZE = 500`, with representative affected items capped by `INVENTORY_ATTENTION_REPRESENTATIVE_LIMIT = 5` per group. UI totals must be treated as exact counts; representative item lists are examples, not exhaustive history.
- Implemented: `/dashboard/inventory/inbox` is the first Inventory Inbox surface. It renders grouped attention categories, summary counts, rule explanations, representative affected records, and direct links back into the existing Inventory workflow. It does not create a second inventory management system.
- Implemented: The existing Inventory page accepts `?attention=missing_price`, `?attention=missing_cost_basis`, `?attention=missing_storage_location`, `?attention=unknown_condition`, and `?attention=unknown_finish` and maps those links to the current saved-view/filter controls. The Inbox identifies work; the Collection surface performs the work.
- Implemented: Dashboard priorities now consume the same shared Inventory Attention summary rather than duplicating pricing/storage/condition/finish rules.
- Planned: Detailed Inbox pagination or database-backed issue materialization should be added before treating the Inbox as a full historical audit queue for very large inventories.
- Deferred: stale inventory, price spikes/declines, demand, velocity, sell-through, underpriced/overpriced listings, grading candidates, duplicate consolidation, and near-buildable-deck opportunities remain excluded until Trading Docks has reliable persisted history, marketplace snapshots, listing states, or deck-opportunity event data. The current implementation intentionally does not infer those signals from current-state rows.

## Universal Card Workspace Architecture

- Implemented: `/dashboard/cards/[inventoryItemId]` is the first canonical Card Workspace route. It authenticates with the server Supabase cookie session, never accepts a client-supplied `user_id`, and loads personal inventory only through `inventory_items.user_id = authenticated user id`.
- Implemented: `src/lib/card-workspace.ts` defines the shared `CardWorkspaceData` view model for card identity, exact printing, market valuation, aggregate user position, individual inventory records/lots, attention issues, selling references, deck references, other printings, and real actions. This is shared product infrastructure rather than a decorative modal.
- Implemented: Exact identity starts from a stable inventory item id. Related lots resolve by `scryfall_id` where available, then by the saved card name/set/collector-number tuple, and finally by card name as a fallback. The workspace preserves individual lots when condition, finish, storage, cost, or quantity differ.
- Implemented: Inventory aggregation separates the aggregate position from individual records. Quantity is summed across related lots. Market value is calculated as saved unit valuation times quantity only when a saved inventory valuation exists. Cost basis never treats missing data as zero.
- Implemented: Cost basis uses saved per-unit cost fields in `inventory_items.data` when present (`unitCost`, `costBasis`, or `purchasePrice`). Average cost is weighted over copies with known cost only. The UI explicitly reports partial coverage, such as cost known for 2 of 3 copies, and shows unavailable when no cost basis exists.
- Implemented: Valuation precedence is deliberately narrow: saved exact inventory valuation is used first; otherwise valuation is unavailable. The Card Workspace does not infer foil value from nonfoil data, copy prices between printings, invent historical movement, or show gain/loss without both valuation and known cost basis.
- Implemented: Attention integration consumes `buildInventoryAttentionSummary` from `src/lib/inventory/intelligence.ts` and surfaces missing price, missing storage, unknown condition, and unknown finish at the affected inventory-record level. The UI does not duplicate the attention rules.
- Implemented: Real actions are limited to existing flows: edit the inventory record, open Collection filtered to the card, and open Deck Builder. Marketplace listing, auto-pricing, grading, selling recommendations, and prediction actions remain deferred until backed by real product flows.
- Implemented: Initial integrations point Inventory table actions, Inventory Inbox representative rows, and global card search inventory placements to `/dashboard/cards/[inventoryItemId]`. The legacy `/dashboard/inventory/[cardId]` editor remains available for record mutation.
- Implemented: Query behavior is bounded: the route loads one authenticated anchor item, up to 50 related inventory lots, up to 200 user locations, bounded trade/wishlist/listing/deck references, and up to 8 Scryfall other-printing examples cached for one hour. It avoids full inventory scans, N+1 location reads, and full deck-table expansion beyond the bounded Deck Vault summary read.
- Security: Catalog/other-printing data can be public, but quantity, location, cost basis, attention issues, deck usage, and listing references are user-private. Every Supabase table read in the loader is scoped by the authenticated user id.
- Planned: Promote reusable drawer/intercepted-route launch behavior after the direct route proves stable. Additional surfaces such as Deck Architect card previews, Deck Builder, and purchasing intelligence should adopt the same model carefully without breaking specialized workflows.
- Deferred: historical price charts, price momentum, demand scoring, liquidity, grading recommendations, automated repricing, sell-now recommendations, and future price prediction remain intentionally absent.

## Financial And Inventory Event Foundation

- Implemented: Shared financial domain logic lives in `src/lib/financials/domain.ts`. It defines cost-basis coverage, inventory-position financials, and realized-profit calculations separately from UI components.
- Implemented: Cost basis has explicit semantics: known unit cost, known total acquisition cost, partial known coverage, or unknown. Missing acquisition cost is never treated as zero. Position-level weighted average cost is calculated as `sum(known lot cost) / sum(quantity with known cost)`, and UI labels report coverage such as `Known cost basis for 7 of 10 copies`.
- Implemented: Realized-profit calculation excludes separated tax from seller revenue. Net proceeds subtract marketplace fees, payment fees, seller discounts, refunds, seller-paid shipping, supplies, and other expenses. Realized profit is unavailable when allocated cost basis is unknown; ROI is unavailable when cost basis is unknown or zero to avoid infinite/false ratios.
- Implemented: Seller/Store Business Command Center gross sales, order counts, AOV, channel activity, fulfillment, and sync issues continue to use real `marketplace_orders` / `marketplace_order_items` rows scoped by authenticated `user_id`. Known profit is now reported with sold-unit coverage instead of assuming order cost defaults represent true acquisition cost.
- Implemented: Inventory Attention includes `missing_cost_basis` so acquisition-history gaps are visible without pretending legacy rows have purchase costs.
- Implemented: Card Workspace uses the shared cost-basis model for `Your Position`, shows known/partial/missing cost coverage, shows unrealized gain/loss only when both saved valuation and known cost basis exist, and renders recent ledger events with typed before/after details instead of raw JSON.
- Implemented: `supabase/migrations/202608120002_inventory_event_ledger.sql` is the production inventory ledger migration. It creates `inventory_events`, typed event/source enums, ownership indexes, idempotency, composite user/item and user/location foreign keys matching the existing text-key inventory schema, RLS-select-only access for authenticated users, and an append-only trigger for normal operation.
- Implemented: The live event taxonomy is explicit: `inventory_created`, `quantity_added`, `quantity_removed`, `quantity_adjusted`, `location_changed`, `condition_changed`, `finish_changed`, `cost_basis_changed`, `inventory_archived`, `inventory_restored`, and `imported`. Vague update events are intentionally excluded.
- Implemented: Inventory mutation consistency is owned by focused database RPCs. `apply_collector_inventory_mutation` locks the authenticated user's inventory row with `FOR UPDATE`, applies quantity/condition/finish/storage changes, and inserts the ledger event in the same database transaction. `create_inventory_item_with_event` derives `user_id` from `auth.uid()`, inserts a new inventory row, and records `inventory_created` or `imported` with optional related-entity/idempotency context.
- Implemented: Web Collector Workspace, web Storage Location assignment, Purchasing Intelligence add-to-inventory, mobile collector mutations, mobile storage moves, scanner saves, and scanner replay now use the ledger RPCs for the inventory paths they directly control. Trade Binder and Wishlist mutations remain in their own tables and do not emit inventory events unless they also mutate `inventory_items`.
- Deferred: Historical backfill is intentionally not performed. Existing inventory simply has no pre-ledger history; Trading Docks does not fake acquisition dates, original quantities, or purchase history from current state.
- Planned: Future sale allocation will connect order line financials to inventory lots through `related_entity_type`/`related_entity_id` once Trading Docks has authoritative order/item linkage. No FIFO/LIFO/profit allocation is inferred from current inventory rows.
- Planned: A future Collection Intake / Buy Calculator can create acquisition records, cost basis, inventory rows, and related inventory events using the existing related-entity and monetary columns without redesigning the ledger.
- Security: Financial data, cost basis, profit, inventory history, and workspace linkage are private account data. Card Workspace event reads are scoped by authenticated `user_id`; RPCs derive identity from `auth.uid()` and reject cross-user inventory or location ids. Normal authenticated users cannot insert/update/delete ledger rows directly.
- Performance: Card Workspace history reads are bounded to 12 recent events and use `(user_id, inventory_item_id, occurred_at desc, id desc)`. General user/workspace activity uses user/source/type/time indexes. Large import paths should batch inventory creation through RPC-compatible server batches rather than one network round trip per row.

## Label Studio And Inventory QR Architecture

- Implemented: Shared SKU, QR, label-template, bulk-render, repricing, and future POS contracts live in `src/lib/label-studio`.
- Implemented: Headquarters exposes `/dashboard/label-studio` as the canonical Operations Label Studio workspace for staging-backed template persistence, inventory label identity resolution, QR labels, barcode labels, repricing review, and browser print-job audit records.
- Implemented: Label Studio capabilities are registered in the shared platform-access model: `label.view`, `label.manage_templates`, `label.print`, `inventory.reprice`, and `pos.sell`.
- Implemented: Public QR view helpers strip cost basis, internal database ids, private notes, and customer/store-private fields before returning customer-facing data.
- Implemented: Product navigation places Label Studio under `Operations` -> `Label Studio`, gated by `label.view`; it does not live under Selling.
- Implemented: `/dashboard/label-studio` remains the only canonical Label Studio route. Inventory, Card Shows, Sealed Inventory, and future POS launch contextual print flows into that route instead of owning separate label builders.
- Partially Implemented: The staging-applied Label Studio migration provides workspace-scoped SKUs, QR identities, token revocation, label templates, print jobs, and repricing review. Production persistence still requires explicit rollout approval and environment verification.
- Implemented: `/q/{token}` resolves through the sanitized public Supabase function and does not expose inventory ids, workspace ids, cost basis, suppliers, storage locations, or private notes.
- Planned: Mobile QR scanner mode should be added later as a separate scanner-mode integration that does not alter card recognition architecture.

## Deck Architect Architecture

- Implemented: Web Deck Architect lives at `/dashboard/deck-architect` and is linked from the Collector workspace navigation alongside Deck Vault.
- Implemented: The route authenticates through the existing Supabase server-cookie session and loads a user-scoped collection snapshot from `inventory_items`; it does not use localStorage or cross-user data.
- Implemented: Core deterministic engine contracts live in `src/lib/deck-architect`, including format profiles, build intents, ownership comparison, card-role classification, legality validation, buildability scoring, commander candidate detection, and deck-health analysis.
- Implemented: `src/lib/deck-suite/domain.ts` is the shared Deck Architect / Deck Builder / Deck Vault adapter layer. Deck Vault `DeckRecord` remains the canonical persisted deck representation, while Architect requirements are derived adapters for analysis and recommendations.
- Implemented: Initial format support is format-aware rather than Commander-only: Commander, Standard, Modern, Pioneer, Pauper, Legacy, Vintage, Brawl, casual 60-card, and custom foundations are represented.
- Implemented: The first Deck Intelligence provider is `trading-docks-local-deck-knowledge`, a Trading Docks-authored deterministic provider. It ranks owned Commander shells and local Pauper archetype opportunities, exposes provenance, confidence, and owned substitutions, and avoids copied third-party decklists.
- Implemented: Deck Architect now distinguishes Full Intelligence formats from builder/legality-only formats. Pauper is the first 60-card Full Intelligence format with archetype shells, sideboard role plans, 60-card construction, buildability, ownership gaps, substitutes, and export compatibility.
- Implemented: Commander strategy intelligence uses a provider/domain layer rather than UI hard-coding. `CommanderKnowledgeProvider` and `CommanderShell` model commander profiles, strategies, recommended cards, flexible role targets, curve targets, and mana-base ranges so a licensed EDHREC adapter, approved public corpus, or internal Trading Docks provider can be swapped in later.
- Implemented: The active EDHREC-class provider is Trading Docks-authored local commander knowledge. It does not scrape EDHREC or call undocumented EDHREC endpoints. Scryfall remains the lawful card metadata, legality, image, and printing source, while Commander Spellbook remains an additive combo-signal provider.
- Implemented: Krenko, Mob Boss / Goblin Swarm is now the golden complete-Commander benchmark. Supported Krenko generation produces a validated 100-card list with 1 commander, 99 main-deck cards, algorithmic basic-land quantities, Goblin density, acceleration, draw/advantage, interaction, haste/untap support, sacrifice outlets, and token payoffs.
- Implemented: Commander generation has a dedicated mana-base phase. The engine reserves nonland slots, adds legal utility lands when strategy/color identity justify them, then fills the remaining Commander deck size with basic lands as quantities instead of depending on search results to provide dozens of individual basic-land candidates.
- Implemented: Sparse or unsupported commanders still return `draft_shell`; complete status requires exact deck size, singleton/color identity legality, role coverage, commander/archetype density, professional evidence, budget checks, and final sanity review.
- Implemented: Commander recommendations now start from commander profile, available strategy/theme evidence, and commander plus strategy candidate pools before using the global legal catalog for support roles, mana bases, and validated alternatives. Generic legal cards cannot define a Commander deck identity.
- Implemented: Commander construction now creates a structured `DeckPlan` before selecting non-commander cards. The plan records the selected strategy, primary and secondary game plans, key enablers, payoffs, support roles, win conditions, anti-synergies, mechanical requirements, role ranges, mana/ramp expectations, build intent, and budget constraints.
- Implemented: `CommanderMechanicalProfile` models commander-specific reward structures such as Winota Human/non-Human trigger balance, Nekusar wheels and draw punishment, Krenko Goblin density, Muldrotha permanent recursion, and Atraxa strategy-specific poison versus counter plans.
- Implemented: Strategy ranking is collection-aware. It considers owned support cards, role overlap, commander color identity, missing core cards, known missing-card prices, and build intent. Popularity does not inflate Buildability.
- Implemented: The shared legality service validates generated and proposed decks for size, copy limits, singleton rules, sideboards, color identity, legality status, locked cards, and must-include cards. Generated complete decks are validated before being presented as valid.
- Implemented: The role classifier now centralizes ramp, mana rocks, mana dorks, rituals, Treasure generation, cost reduction, color fixing, land fixing, card draw, card advantage, wheels, group draw, draw punishment, conditional draw, incidental draw, cantrips, hand cycling, targeted and mass removal, countermagic, protection, tutor, recursion, graveyard interaction, token generation, Goblin token makers/payoffs, haste enablers, sacrifice, discard, threats, finishers, synergy, combo pieces, lifegain, burn, poison/infect/toxic/proliferate, and artifact/enchantment interaction signals. Mono-color Commander builds do not create an artificial color-fixing quota.
- Implemented: Deck Architect can save a generated or loaded working deck into the existing Deck Vault store and open the active deck in Deck Builder without serializing the decklist into URL parameters.
- Implemented: Deck Builder exposes "Analyze with Deck Architect" using a compact Deck Vault deck id; the Architect server loader re-reads the deck scoped to the authenticated user before analysis.
- Implemented: Commander selection supports Owned and Potential modes. Potential commanders are loaded through the existing supported card-search path, shown with imagery where available, and marked as not owned for missing-card summaries.
- Implemented: Shared import parsing and export adapters cover sectioned/plain text input plus plain-text, CSV, MTGO-style, and Arena-compatible output where card identifiers allow it.
- Partially Implemented: The workspace evaluates collection-derived requirements, owned and potential commander candidates, Pauper archetype opportunities, Commander strategy signals, and review-first add/substitution recommendations. Structured proposal persistence and apply/revert mutations are not active yet.
- Partially Implemented: Proposal application exists as an atomic validated domain operation, but persistent proposal review/history is still intentionally disabled until a schema proposal is reviewed.
- Partially Implemented: AI is represented as future orchestration infrastructure only. Current recommendations are deterministic, validated, review-first, and do not claim autonomous deckbuilding or live external intelligence.
- Implemented: The customer-facing workspace now uses progressive build flow states and hides Buildability and Deck Health scores until a complete working deck target exists.
- Implemented: Collection mapping now reads existing inventory payload metadata for images, oracle text, mana cost, colors, color identity, type line, legalities, locations, and pricing where available.
- Implemented: Commander recommendations now attach structured evidence for legality, archetype affinity, commander affinity, role fit, strategy fit, curve fit, ownership, confidence, and internal rejection reasons. The professional quality floor rejects legal/color-compatible cards when evidence is too weak rather than filling decks with low-confidence cards.
- Implemented: Commander generation now fails closed on unknown Commander legality and malformed canonical metadata for final-build candidates. Sparse candidate pools remain draft shells instead of padding to 100 cards with low-confidence filler.
- Implemented: Selected nonland cards now receive a structured `CardInclusionJustification` with primary role, secondary roles, commander relationship, strategy relationship, deck-plan relationship, professional evidence class, alternative advantage, confidence, ownership, and budget status.
- Implemented: Commander deck assembly now runs a bounded Build -> Critique -> Revise -> Validate loop. The deterministic critic reviews the whole deck for weak justifications, missing functions, overrepresented roles, mechanical profile gaps, generic filler, and anti-synergies, then requests validated replacements rather than inserting arbitrary cards directly.
- Implemented: A `DeckCriticProvider` boundary exists for a future reasoning-model critic. AI may critique, identify weak cards, and request replacements, but deterministic Trading Docks legality, color identity, budget, evidence, and validation gates still decide final cards and status.
- Implemented: A final human-sanity gate prevents `Complete` status when high-severity critic findings remain, low-confidence nonland inclusions survive, or the deck plan cannot justify the list.
- Implemented: Nekusar is now a curated commander benchmark with Wheels / Group Slug and Burn / Draw Punishment strategy profiles. Budget, Use My Collection, and No Purchases intents preserve strategy identity instead of replacing core archetype cards with unrelated owned or cheap filler.
- Implemented: Winota is now a curated commander benchmark with Aggressive Combat / Winota Triggers planning. The engine distinguishes non-Human enablers from Human payoffs and treats random generic fixing as support only when it advances the plan.
- Implemented: Budget Mode sends explicit maximum individual missing-card and total missing-card constraints into the Commander build engine. Budget checks apply only to cards the user needs to acquire; expensive owned cards remain eligible and unknown missing-card prices are not treated as free.
- Implemented: Commander Spellbook combo intelligence is behind `src/lib/deck-architect/combo-provider.ts`, with server-side fetches, timeout handling, TTL caching, provider-stage logging, normalized Trading Docks domain types, and graceful fallback. Deck Vault combo analysis uses this provider; combo relevance is additive and not a hard dependency for deck generation.
- Implemented: `src/lib/deck-architect/deck-corpus.ts` defines the Trading Docks Deck Corpus foundation for lawful aggregate deck observations, sample-size thresholds, inclusion-rate eligibility, synergy lift, co-occurrence, and provenance. No user deck harvesting or persistence migration is active in this checkpoint.
- Implemented: `src/lib/deck-architect/commander-meta-provider.ts` defines an EDHREC-compatible provider boundary for commander profiles, strategies, commander-card evidence, and strategy-card evidence. EDHREC is not integrated, scraped, crawled, mirrored, or used as a backend; a licensed implementation can be attached later after commercial permission is secured.
- Implemented: Lawful-source boundary is explicit. Trading Docks may use Scryfall's documented API/bulk-data model for card facts, Commander Spellbook's documented/open combo project for combo relationships, user-imported decks where permission is clear, and future licensed commander-meta feeds. Direct EDHREC production use requires explicit commercial/API permission before automated access.
- Planned: Add saved proposal persistence, Deck Vault proposal history, reviewed corpus persistence, provider freshness checks, and licensed external commander-meta providers after legal/data review.
