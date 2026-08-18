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
- Implemented: Redesign mobile Home Product V2 into a simpler card-first hierarchy with one summary hero, up to four quick actions, real Recent Adds, one contextual insight, and no fake activity or metrics.
- Implemented: Polish the mobile bottom navigation into one compact, account-aware five-tab bar with consistent Ionicons, restrained center action treatment, selected state, safe-area sizing, and no Explore placeholder tab.
- Implemented: Add a focused mobile product polish pass with shared TD chips, metric tiles, icon rows, compact card defaults, zero negative tracking, and active-screen migrations for Collection, Card Detail, Storage, Trade Binder, Wishlist, Scanner, Session Review, and Profile.
- Implemented: Simplify Scanner Session Review into a beginner-friendly finalization workflow with four primary metrics, Review next, status tabs, filter sheet, card review sheet, sticky actions, and preserved offer/session behavior.
- Implemented: Establish the Trading Docks mobile design OS with a current-state audit, design bible, mobile component contracts, accessibility standard, motion standard, migration plan, expanded TD primitives, centralized nav visual model, and focused Seller/Signals plus Deal Desk polish.
- Partially Implemented: The mobile design OS is now the migration authority, but full route-by-route visual rollout still requires staged QA rather than a single sweeping redesign.
- Partially Implemented: Home market movement, recent activity, notifications, and operations signals remain unavailable until real data sources exist.
- Planned: Remove or archive backup dependency folders and historical release artifacts only after product-owner review.
- Planned: Add missing tests for auth redirects, plan gates, billing webhook behavior, public share token safety, and key route handlers.
- Implemented: Integrate the RevenueCat mobile SDK, Supabase UUID appUserID lifecycle, package/entitlement mapping, custom mobile Membership purchase UI, Restore Purchases entry point, public config validation, and focused subscription contract tests.
- Partially Implemented: RevenueCat purchase/restore results do not unlock protected access from the client. Backend webhook reconciliation is implemented in source, but migration rollout, dashboard configuration, and physical Sandbox QA are pending.
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
- Implemented: Redesign scanner navigation into Scanner Product V3 with one Trading Docks Scanner entry, Review List post-processing, simplified settings hierarchy, a `/scan/single` compatibility alias, and no fake Grid Scan route.
- Implemented: Add a shared scanner readiness language for Auto Scan ON and OFF with cyan Searching, amber Needs Attention, emerald Ready, blue Processing, one user-facing instruction, manual Capture as the reliability baseline, and readiness-gated automatic capture.
- Implemented: Remove Deal Desk from Mobile V1 primary navigation so every account composition has exactly five tabs: Home, Collection, Scan, Intelligence, and Account.
- Implemented: Repair the active web admin manual membership override button state so admins can explicitly save an override even when the resolved membership already displays that tier.
- Implemented: Extend mobile Collection search to include user-scoped storage-location name matches.
- Implemented: Establish a shared physical-binder contract for mobile and Headquarters without creating a separate mobile-only binder system.
- Implemented: Repair the Automatic Scan trigger so stable card geometry invokes the same `captureStill` path automatically, blocks duplicate same-card captures, and rearms only after removal or a clear new-card geometry transition.
- Implemented: Establish Rapid Scan and Precision Scan throughput contracts with a Rapid card-change state machine, fixed title/bottom-left ROIs, bundled local Magic name index matching, confidence routing, result-tray helpers, destination inheritance, and benchmark metrics.
- Partially Implemented: Rapid/live OCR remains source-tested experimental scanner architecture, but it is no longer the active production recognition path. Production uses one captured-still OCR path for Auto Scan ON and OFF until physical benchmark evidence supports another recognizer.
- Implemented: Establish the first shared multi-signal recognition decision model with normalized-card geometry evidence, compact visual fingerprint matching, local title OCR matching, confidence fusion, best-frame selection, benchmark comparison hooks, and identity-first printing refinement.
- Implemented: Keep Rapid, visual descriptor, pHash, Feature Print, and fusion comparison behind the development Scanner Recognition Lab while the production scanner stays on captured-still OCR plus local Magic-name identity.
- Partially Implemented: Visual recognition now uses a production-scale Scryfall artwork-derived compact descriptor index with 57,519 descriptor records, replacing the 9-record seed. Production work still needs physical benchmark results, native perspective rectification, and any threshold tuning evidence before accuracy claims.
- Implemented: Add a development-only Scanner Recognition Lab to compare OCR Accurate, current pHash, and Apple Vision Feature Print on the same captured card image before choosing a production recognizer.
- Partially Implemented: Mobile/web data parity is audited in `docs/MOBILE_WEB_DATA_PARITY.md`; mobile Collection/Trade Binder/Wishlist/Storage use shared Supabase tables, and scanner Review List finalization now writes collection-destination lines through the canonical backend confirmation path.
- Implemented: Mobile inventory remains the V1 product center with Home art-piece composition, scan destination selection, Card Show percentage mode, physical binder UI/share creation/revocation, hierarchy breadcrumbs, and compact scanner benchmark export.
- Partially Implemented: Purchase History now has a canonical acquisition-ledger contract, real dashboard surface, Bulk Buying save action, guarded API write path, and forward-only Supabase proposal. Production persistence still requires staging application/verification of `202608110001_purchase_history_ledger_proposal.sql`.
- Requires Production Configuration: Physical scanner performance budgets remain follow-up work until measured iOS/Android runs are collected.
- Planned: Build production Grid Scan only after benchmarked multi-card recognition and review-queue handling exist.
- Partially Implemented: Scanner performance diagnostics now keep a bounded local history with capture, OCR, Scryfall lookup, session write, total-to-session latency, preview/capture resolution, fallback count, measured averages, compact Markdown plus sanitized JSON export, bounded catalog lookup caching, prewarming hooks, and a development benchmark run summary harness; physical-device benchmark budgets and camera FPS still need measured iOS/Android runs.
- Partially Implemented: Scanner Review List rows now receive asynchronous Scryfall price enrichment for positive exact-printing prices with stale-row and manual-price guards; normalized price history and provider freshness policy remain future work.
- Implemented: Scanner camera framing now uses a safe-area-aware guide layout and centralized Expo Camera still-capture settings for maximum quality, native orientation processing, autofocus, shutter feedback, and supported iOS responsive orientation.
- Implemented: Scanner camera selection now uses a truthful VisionCamera mode contract for Auto, Close-up, Standard, and Telephoto, hides duplicate fixed-mode mappings, remounts on device/profile changes, and provides development-only Camera QA cycling and diagnostics.
- Partially Implemented: Actual device mode inventories and hands-free auto-capture still need physical iOS/Android development-build QA before production readiness claims.
- Implemented: iOS Apple Vision captured-still rectangle detection is available through `TradingDocksVisionOcr.detectCardRectangle`, and the OCR pipeline uses detected card bounds before falling back to the guide crop.
- Partially Implemented: iOS captured-still OCR, captured-still rectangle detection, and shared local Magic title identity are implemented, but artwork matching, set-symbol recognition, true perspective-warp image output, Android OCR, and foil classification remain provider contracts until benchmarked; the scanner does not fake recognition accuracy.
- Partially Implemented: Magic recognition is metadata-backed and confirmation-first until product-owner private fixture benchmarks establish accuracy, latency, and false high-confidence rates. The builder labels ground truth; it does not determine ground truth from captured images.
- Partially Implemented: Multi-TCG catalog providers and universal inventory persistence remain planned; active writes are still Magic-compatible.
- Partially Implemented: Native network reachability is not independently observed yet; queued scanner adds still retry on app resume, session restoration, and manual retry.
- Partially Implemented: Mobile active workspace authority remains user-scoped for collection workflows; Store/team shared workspace data requires a dedicated resolver and RLS review before production reliance.
- Planned: Validate Collector query plans against staging-scale data and add proposed indexes only after measurement.
- Planned: Apply the Collector mutation security proposal only after staging replay, product-owner approval, and service-role/import impact review.
- Planned: Add distributed rate limiting for public image/market endpoints.
- Planned: Add production monitoring, structured logging, alerting, and PII scrubbing.
- Planned: Convert demo/sample surfaces into explicit empty states or real data-backed views.

## Later

- Partially Implemented: RevenueCat-backed mobile subscriptions are wired in the app, but production access activation is blocked by webhook reconciliation, public EAS SDK-key configuration, clean EAS rebuild, and physical Sandbox purchase/restore QA.
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

## Mobile Release Candidate Pass

Status: Partially Implemented.

Implemented this pass:

1. Added `docs/MOBILE_RELEASE_CANDIDATE_AUDIT.md` with a current route-by-route release audit and BLOCKER/HIGH/MEDIUM/POLISH classification.
2. Added `docs/MOBILE_BILLING_RELEASE_ARCHITECTURE.md` to separate mobile digital subscription requirements from web Stripe billing and real-world/physical-goods workflows.
3. Added `docs/MOBILE_PRIVACY_RELEASE_AUDIT.md` and `docs/MOBILE_STORE_RELEASE_CHECKLIST.md` for store-readiness and privacy review.
4. Replaced fake legacy `/experience` demo content with a redirect to the active workspace.
5. Replaced the default template modal with a branded fallback and removed customer-facing provider/configuration copy from the mobile plan path.
6. Polished launch, welcome, auth error, and onboarding copy without changing auth mechanics, membership pricing, Supabase schemas, billing providers, or scanner recognition.

Remaining release work:

1. Complete physical-device QA before claiming Release Candidate status.
2. Decide whether paid mobile subscriptions are included in the first TestFlight; if yes, implement the approved StoreKit/Google Play Billing provider and backend entitlement reconciliation.
3. Verify production builds hide `/dev/*`, diagnostics sheets, crop proofs, scanner benchmark builder, and design-system showcase routes.
4. Confirm privacy policy, terms, support URL, delete-account compliance, App Privacy, Data Safety, screenshots, and review notes.
5. Add visual regression coverage after authenticated fixtures are stable.

## Mobile Production Release Readiness

Status: Partially Implemented.

Implemented this pass:

1. Set canonical mobile identifiers in `mobile/app.json`: iOS bundle id `com.tradingdocks.app` and Android package `com.tradingdocks.app`.
2. Added typed mobile release configuration for production-safe support/legal links, version/build display, development-tool gates, and public-env secret detection.
3. Added a support-assisted account deletion request route and linked it from Profile and Settings without adding unsafe client-side destructive deletion.
4. Added a production-safe mobile route error boundary and not-found fallback.
5. Added `mobile/scripts/verify-production-release.js` and `npm run verify:production-release`.
6. Documented production env requirements, store assets, blocker table, privacy disclosure matrix, and Free-only mobile RC billing strategy.

Remaining release work:

1. Run physical-device iOS/Android QA on a clean EAS build.
2. Product-owner/legal approval for account deletion policy, support email/URL, privacy URL, terms URL, App Privacy, Data Safety, screenshots, and review notes.
3. Keep paid mobile upgrades disabled or informational until native billing and backend entitlement reconciliation are approved.
4. Do not claim scanner/OCR/auto-capture production accuracy until measured device benchmarks support it.

## Platform Authority Refactor

Status: Partially Implemented.

Implemented this checkpoint:

1. Added one typed `PlatformAccessContext` separating auth identity, platform role, account type, membership tier, billing status, entitlements, workspace id, workspace role, provider state, suspension, and warnings.
2. Added a typed action-based capability registry.
3. Added explicit active dashboard route-access classification with fail-closed behavior for unknown dashboard paths.
4. Added reusable server route and API capability guards.
5. Added client-safe access adapters for navigation and upgrade display.
6. Migrated active user-facing dashboard API plan gates to `requireApiCapability` where capabilities apply.
7. Added source-contract tests for tier normalization, capability behavior, route/API agreement, active dashboard/API classification coverage, and legacy drift prevention.

Recommended next checkpoint:

1. Add route-handler integration fixtures for `401` unauthenticated and `403` unauthorized behavior.
2. Audit webhook, OAuth callback, cron, and server-only API authorization separately from user capability guards.
3. Resolve workspace-owned inventory and Store employee semantics before team workflows become production critical.
4. Create a forward-only SQL plan to replace historical email-based owner helpers with `user_roles` helpers.
5. Align Stripe and RevenueCat provider-state reconciliation behind the same server access lifecycle.

## Label Studio And Inventory QR

Status: Partially Implemented.

Implemented this checkpoint:

1. Added shared SKU, QR token, sanitized QR view, label template, pricing rule, bulk print, repricing, and POS lookup contracts.
2. Added a Headquarters Label Studio foundation route at `/dashboard/label-studio`.
3. Registered Label Studio and POS-related permissions in the platform capability registry.
4. Wired the staging-applied schema into `/api/label-studio`, `/dashboard/label-studio`, and public `/q/{token}` resolution for browser review.
5. Confirmed product placement: Label Studio belongs under `Operations` -> `Label Studio` using `label.view`, while Inventory, Card Shows, Sealed Inventory, and future POS remain contextual entry points into `/dashboard/label-studio`.

Recommended next checkpoint:

1. Complete staging browser review for template persistence, template reload, real SKU/QR generation, public QR resolution, QR disabled/revoked behavior, bulk labels, browser printing, print-job persistence, repricing review, and cross-workspace denial.
2. Validate print CSS on representative label stock and store printer settings.
3. Approve production rollout only after staging environment and Supabase project targeting are verified.
4. Add mobile QR scanner mode as a separate scan mode without changing card recognition.

## Deck Architect

Status: Master Brewer Foundation Implemented.

Implemented this checkpoint:

1. Added `/dashboard/deck-architect` as a Collector workspace surface connected to the existing dashboard navigation.
2. Added deterministic deck-architecture contracts for formats, build intents, ownership comparison, buildability scoring, commander candidates, missing-card visibility, and deck-health categories.
3. Loaded real user-scoped collection data from `inventory_items` for the initial collection graph snapshot.
4. Kept proposal review, must-include, locked-card, and AI concepts as explicit foundations without claiming autonomous deckbuilding.
5. Polished the active product surface into a progressive customer workflow with card imagery, Commander selection, deck/card/intelligence modes, card-detail drawer, ownership states, and honest unavailable states for save/apply persistence.
6. Added a deterministic Deck Intelligence provider with Trading Docks-authored Pauper archetype profiles, Commander strategy inference, legality validation, ranked "What Can I Build?" opportunities, confidence signals, and owned-card substitutions.
7. Added a shared deck-suite adapter layer so Deck Vault `DeckRecord` remains the canonical persisted deck representation for Architect, Builder, import, export, and analysis handoffs.
8. Added Architect -> Builder and Builder -> Architect handoffs using saved Deck Vault records or compact deck ids instead of URL-serialized decklists.
9. Added owned/potential commander discovery, shared import parsing, and shared deck export adapters for plain text, CSV, MTGO-style, and Arena-compatible output where supported.
10. Added the first production recommendation intelligence layer: expanded role classification, collection-aware commander strategy ranking, validated Pauper archetype construction, validated Commander shell construction, structured add/cut swaps, owned substitute ranking, and atomic non-persistent proposal application.
11. Added the Master Brewer foundation: natural-language goals are parsed into structured constraints, Hidden Synergy clusters, Deck Personality signals, Role Compression insights, strategy-overload warnings, What If/Fork proposal previews, Surprise Me directions, and collection-specific opportunity discovery.
12. Added an explicit Build My Deck transition so setup choices do not present as a finished deck until the user asks Deck Architect to assemble one.
13. Preserved the safety boundary: AI-style brewer proposals remain structured and validator-backed; raw model text cannot directly mutate or persist a deck.
14. Hardened Commander recommendations to be evidence-first: commander profile and selected strategy evidence now seed deck identity before global catalog fallback, with Nekusar Wheels / Group Slug and Burn / Draw Punishment as production regression benchmarks.
15. Added Budget Mode controls for maximum individual missing-card price and total missing-card budget. Budget rules apply after commander relevance, strategy relevance, professional quality, and role fit; unknown missing-card prices are not treated as free.
16. Expanded card-draw semantics so wheels, group draw, draw punishment, cantrips, conditional draw, and incidental draw no longer satisfy the same major card-advantage role automatically.
17. Added the first human-reasoning architecture for Commander builds: DeckPlan creation, commander mechanical profiles, card-level inclusion justifications, pairwise candidate comparison, deterministic critic findings, bounded replacement loops, and a final sanity gate before Complete status.
18. Added Winota as a structural Commander benchmark so the engine can distinguish non-Human enablers from Human payoffs instead of filling Boros roles mechanically.

Recommended next checkpoint:

1. Add saved proposal persistence and apply/revert flows into Deck Vault with stale-deck protection.
2. Add an approved LLM provider contract that emits only structured proposal JSON for deterministic validation.
3. Add external provider-backed archetype/template catalogs with source attribution and no copied third-party workflows.
4. Expand legality/provider validation from saved Scryfall legalities into provider refresh and stale-data handling.
5. Expand collection leverage from deterministic Pauper/Commander opportunities into complete candidate deck planning for additional formats after provider quality is verified.
6. Extend the implemented Commander Spellbook provider from Deck Vault combo analysis into richer Deck Architect combo panels and reviewed combo-aware proposals.
7. Review and approve a Trading Docks Deck Corpus persistence migration before storing aggregate deck observations.
8. Add customer-facing budget alternative labels and custom budget entry once the recommendation review UI has persistence and apply/revert flows.
9. Add persisted DeckPlan, critique, and revision-history review surfaces once proposal storage is approved.
