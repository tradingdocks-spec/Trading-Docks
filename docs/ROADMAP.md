# Roadmap

## Foundation First

Do not add new production features until the foundation items below are reviewed.

## Sprint 1: Stabilize the Platform

- Implemented: Stabilize the active Expo auth screen, Supabase session restoration, remembered-email preferences, safe admin routing, and focused auth tests.
- Implemented: Establish first design-system foundation with shared semantic tokens, Expo/Next primitives, development-only showcases, focused primitive tests, and limited auth/profile/loading migrations.
- Implemented: Establish account-aware navigation contracts for active Expo tabs and the active Next.js dashboard shell, including protected admin access as an additive destination.
- Partially Implemented: Align route labels with canonical Collector, Seller, Store, and Admin navigation while leaving unfinished destination content clearly marked for later product sprints.
- Implemented: Establish shared identity/access models and move active web admin authorization from email checks to `user_roles`.
- Planned: Consolidate active dashboard component architecture and mark deprecated dashboard generations.
- Implemented: Align active web/mobile plan tiers, names, pricing, limits, entitlement keys, and provider mapping adapters around a canonical membership catalog.
- Planned: Audit API route authentication, public allowlists, provider callback exemptions, and server-side entitlement checks.
- Planned: Replace legacy Supabase `is_platform_owner()` policies/functions with role-based `is_admin()` equivalents in a reviewed migration.
- Planned: Replace legacy `business` membership schema values and constraints with canonical `store` in a reviewed migration.
- Planned: Verify Supabase migrations replay cleanly into a fresh staging project.
- Implemented: Establish a repository cleanup plan that classifies active apps, backups, generated output, duplicate components, duplicate services, duplicate navigation, duplicate design-system layers, and cleanup risk.
- Partially Implemented: Exclude confirmed backup/archive and generated output folders from active root lint scope.
- Implemented: Establish the first Collector Workspace foundation with shared collection models, mobile/web collection browsers, detail route foundations, and focused collection tests.
- Implemented: Add Collector organization actions for quantity, condition, finish, storage assignment, Trade Binder status, Wishlist state, optimistic rollback, and mobile offline queue de-duping.
- Partially Implemented: Deck usage, scanner recognition, portfolio analytics, trade transactions, and marketplace listing remain visible as integration points but not complete workflows.
- Implemented: Redesign mobile Home around a premium one-handed command-center hierarchy using real collection data, active sessions, unavailable states, and one primary bottom navigation system.
- Implemented: Polish the mobile bottom navigation into one compact, account-aware five-tab bar with consistent Ionicons, restrained center action treatment, selected state, safe-area sizing, and no Explore placeholder tab.
- Implemented: Add a focused mobile product polish pass with shared TD chips, metric tiles, icon rows, compact card defaults, zero negative tracking, and active-screen migrations for Collection, Card Detail, Storage, Trade Binder, Wishlist, Scanner, Session Review, and Profile.
- Implemented: Simplify Scanner Session Review into a beginner-friendly finalization workflow with four primary metrics, Review next, status tabs, filter sheet, card review sheet, sticky actions, and preserved offer/session behavior.
- Implemented: Establish the Trading Docks mobile design OS with a current-state audit, design bible, mobile component contracts, accessibility standard, motion standard, migration plan, expanded TD primitives, centralized nav visual model, and focused Seller/Signals plus Deal Desk polish.
- Partially Implemented: The mobile design OS is now the migration authority, but full route-by-route visual rollout still requires staged QA rather than a single sweeping redesign.
- Partially Implemented: Home market movement, recent activity, notifications, and operations signals remain unavailable until real data sources exist.
- Planned: Remove or archive backup dependency folders and historical release artifacts only after product-owner review.
- Planned: Add missing tests for auth redirects, plan gates, billing webhook behavior, public share token safety, and key route handlers.
- Planned: Add mobile CI or document why mobile validation is manual.
- Planned: Add native-device validation for biometric unlock, Google OAuth, Apple Sign In, and magic-link deep-link callbacks.
- Planned: Continue design-system migration in order: dashboard state surfaces, common cards/headers, input-heavy admin/settings screens, then modal/toast/chart/table primitives.
- Planned: Retire duplicated legacy navigation modules after import ownership is confirmed and missing route content is prioritized.
- Planned: Complete native visual QA for the polished bottom bar across small iPhone, large iPhone, Android, narrow Expo Web, larger text, and light/dark browser rendering.
- Planned: Complete physical-device and simulator visual QA for the broader mobile polish pass across core app screens before release.
- Planned: Continue mobile visual migration in the order documented in `docs/MOBILE_VISUAL_MIGRATION_PLAN.md`, prioritizing authenticated high-traffic routes, no-fake-data cleanup, and physical-device accessibility checks.

## Sprint 2: Production Configuration Readiness

- Requires Production Configuration: Supabase Auth settings, email confirmation, leaked password protection, MFA for admins, applied migrations, storage buckets, and RLS verification.
- Requires Production Configuration: Stripe live/test separation, product/price IDs, webhook signing secret, and customer portal configuration.
- Requires Production Configuration: Vercel environment variables, deployment protection, canonical domain, and observability.
- Requires Production Configuration: Cloudflare inbound email DNS/routing and webhook validation.
- Requires Production Configuration: Marketplace credentials and provider app callback URLs.

## Sprint 3: Product Hardening

- Planned: Build durable sync/retry queues for mobile offline operations.
- Planned: Propose and review DB-side Free-plan card-limit enforcement for native direct writes and offline replay.
- Implemented: Create the Collector mutation security migration proposal and verification SQL for database-level ownership and Free-plan total-quantity enforcement.
- Partially Implemented: Expand the staging verification script to cover zero quantity, explicit overrides, missing identity data, duplicate replay, and service-role behavior notes; clean database replay is still pending approved Supabase tooling.
- Implemented: Add Collector Workspace cursor pagination, server-side search/filter/sort query paths, safe page merging, stale response rejection, and focused pagination tests.
- Implemented: Add a Storage Location Manager for mobile and web with typed location contracts, owner-scoped create/rename/archive/assign/clear/move flows, Find Card search, recent/favorite locations, unassigned cards, archived-location states, and assignment offline queue support.
- Partially Implemented: Storage hierarchy metadata is supported through JSON fields in the current schema; database-enforced hierarchy, archive, favorite, and recent columns remain a migration proposal only.
- Implemented: Add a personal Trade Binder and Wishlist workspace across mobile and web with canonical typed models, search/filter/sort, strict wishlist matching, match summaries, optimistic status/priority updates, and user-scoped mobile offline queue support.
- Partially Implemented: Trade Calculator, card-show packing lists, peer-to-peer offers, messaging, and live trading remain future work and are not activated by this sprint.
- Implemented: Establish mobile scanner foundation with permission states, manual exact-printing search, confirmation into Collection/Storage/Trade Binder/Wishlist, rapid-scan reset, draft recovery, offline queued adds, and privacy-safe no-photo-retention defaults.
- Implemented: Harden scanner offline replay with a user-scoped replay worker, generated inventory-id idempotency, automatic retry on session restore/app resume/Expo Web reconnect, visible sync state, and a compact failed-scan recovery route.
- Implemented: Install and configure `expo-camera`, add guided local capture, and establish multi-signal scanner intelligence contracts plus benchmark contracts.
- Implemented: Establish multi-TCG scanner architecture with game detection, Magic/Pokemon/One Piece/Lorcana adapter contracts, mixed sessions, universal exports, and unsupported-card handling.
- Implemented: Add the Magic recognition provider reference implementation with Scryfall-backed candidate resolution, exact-printing ranking, legal-finish validation, top-three alternatives, explainable confidence, and scanner UI confidence details.
- Implemented: Add Magic scanner benchmark calibration tooling with private manifest validation, ignored fixture/output paths, JSON/CSV/Markdown reports, threshold classes, and advisory calibration recommendations.
- Implemented: Add a feature-flagged private Magic scanner benchmark builder route for creating local labeled datasets without hand-editing JSON.
- Implemented: Add continuous scanner/session and card-show offer foundations with standard card guide geometry, quality-gate contracts, duplicate protection, local running sessions, review filters, offer calculations, and CSV serialization.
- Implemented: Add the first local live-frame analyzer for development-build frame samples, including card-boundary, four-corner, aspect, guide-fill, blur, motion, lighting, glare, fingerprint, targeted OCR mapping, and Magic adapter handoff tests.
- Implemented: Add native scanner calibration contracts, development-only diagnostics, camera-ready capture gating, local guide calibration, and visible unidentified-capture session outcomes for physical QA.
- Implemented: Add native iOS Magic OCR v1 with a local Expo Apple Vision module, guide-assisted captured-still crop mapping, OCR normalization, Scryfall top-three lookup, confidence caps, temporary capture cleanup, and diagnostics.
- Implemented: Redesign the active Scan tab into a premium camera-first Card Show Purchase experience with compact header, large camera viewport, one instruction, Torch/Capture controls, secondary settings/manual/diagnostics panels, and safe-area Review List chip.
- Implemented: Calibrate Magic still-capture OCR for physical iPhone retry flow by normalizing rotated still dimensions, adding primary/expanded/lower/wide/full-card title fallback regions, exposing development-only crop proof, and ensuring Retake resumes the camera without entering the user-paused state.
- Implemented: Stabilize Scanner 2.0 end to end with a canonical camera lifecycle, app background guards, wider title OCR fallback, structured Scryfall outcomes, stale manual-search guards, dev-only crop proof diagnostics, and refreshed physical QA documentation.
- Implemented: Promote Scanner 2.0 to an immersive release-candidate presentation that hides normal bottom navigation only on the active Scan route, fills the screen with camera, keeps Torch/Capture as primary controls, moves Manual Search into scanner settings, uses transient added/remove-card overlays, and removes primary confidence percentages.
- Implemented: Convert Scanner 2.0 active capture into batch-first intake: supported matches auto-add to Review List, likely/ambiguous rows are marked Needs review, failed reads do not add unknown rows, manual search selection adds to the list, and active per-card Add/pricing/metadata controls are removed from the camera surface.
- Partially Implemented: Scanner performance diagnostics now keep a bounded local history with capture, OCR, Scryfall lookup, session write, total-to-session latency, preview/capture resolution, fallback count, measured averages, and sanitized JSON export; physical-device benchmark budgets and camera FPS still need measured iOS/Android runs.
- Partially Implemented: Scanner Review List rows now receive asynchronous Scryfall price enrichment for positive exact-printing prices with stale-row and manual-price guards; normalized price history and provider freshness policy remain future work.
- Partially Implemented: Active camera mode still needs VisionCamera frame bridge wiring and physical-device QA before hands-free auto-capture is production-ready.
- Planned: Native auto-capture implementation is documented in `docs/SCANNER_AUTO_CAPTURE_NATIVE_PLAN.md`; current Scan remains manual still-capture until measured frame signals are available.
- Partially Implemented: iOS captured-still OCR is implemented, but artwork matching, set-symbol recognition, perspective correction, Android OCR, and foil classification remain provider contracts until benchmarked; the scanner does not fake recognition accuracy.
- Partially Implemented: Magic recognition is metadata-backed and confirmation-first until product-owner private fixture benchmarks establish accuracy, latency, and false high-confidence rates. The builder labels ground truth; it does not determine ground truth from captured images.
- Partially Implemented: Multi-TCG catalog providers and universal inventory persistence remain planned; active writes are still Magic-compatible.
- Partially Implemented: Native network reachability is not independently observed yet; queued scanner adds still retry on app resume, session restoration, and manual retry.
- Planned: Validate Collector query plans against staging-scale data and add proposed indexes only after measurement.
- Planned: Apply the Collector mutation security proposal only after staging replay, product-owner approval, and service-role/import impact review.
- Planned: Add distributed rate limiting for public image/market endpoints.
- Planned: Add production monitoring, structured logging, alerting, and PII scrubbing.
- Planned: Convert demo/sample surfaces into explicit empty states or real data-backed views.

## Later

- Planned: RevenueCat-backed mobile subscriptions if mobile in-app purchases become a production requirement.
- Planned: Native mobile release pipeline, app store signing, and deep-link verification.
- Requires Production Configuration: Rebuild the iOS development client after native scanner module changes with `npx eas build --profile development --platform ios`.
- Planned: Multi-tenant workspace/team permission model hardening beyond current owner/member helpers.
## Scanner 2.0 Product Design

Status: Implemented.

Scanner 2.0 establishes the camera-first mobile scanner shell, compact header, exactly two primary controls, batch-first Review List insertion, failure recovery banner, pinned Review List chip, Scanner 2.0 state model, reduced-motion contract, and named scanner component structure.

Recommended next scanner work:

1. Physical iOS QA for camera framing, haptics, and Dynamic Island behavior.
2. Native vision-signal integration for card presence, stabilizing, and removal states.
3. Product-owner decision on when high-confidence auto-accept can be enabled.
4. Benchmark-backed recognition and foil-confidence calibration.

## Mobile Design OS

Status: Partially Implemented.

Implemented this sprint:

1. Audit active mobile route readiness in `docs/MOBILE_PRODUCT_DESIGN_AUDIT.md`.
2. Define the Trading Docks visual language, component contracts, accessibility rules, and motion rules in the new mobile design OS docs.
3. Expand Expo TD primitives without changing auth, billing, Supabase, scanner recognition, OCR module configuration, or memberships.
4. Centralize bottom-navigation visual geometry while preserving the account-aware route contract.
5. Remove unsupported fake business metrics from Seller/Signals and Deal Desk, replacing them with real session state or honest unavailable states.
6. Complete Mobile Design OS Migration Wave 1 for the active mobile shell, Home, Scanner, Collection, Card Detail, and Storage Locations without changing OCR, auth, billing, memberships, Supabase schemas, or route authority.
7. Complete Mobile Design OS Migration Wave 2 for Trade Binder, Wishlist, Scanner Session Review, Deal Desk, Seller/Signals, Profile, Authentication, Welcome, Onboarding, and Plans without changing product behavior.
8. Complete Mobile Design OS Migration Wave 3 for Command Center summary, Settings, Scanner Recovery, dev-only design showcase, global consistency audit, accessibility pass, responsive pass, and release QA documentation.

Remaining staged work:

1. Run physical-device QA across small iPhone, large iPhone, Android, tablet, narrow Expo Web, larger text, and reduced motion.
2. Complete physical-device release QA and then schedule the dedicated admin management mobile sprint for dense admin detail tools.
3. Add visual regression screenshots once stable authenticated fixtures exist.
