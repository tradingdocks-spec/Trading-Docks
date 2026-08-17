# Repository Health

## Technical Debt

- Partially Implemented: Multiple dashboard systems coexist in `src/components/dashboard`, `src/components/dashboard-v2`, and older layout folders.
- Partially Implemented: Large historical release notes and backup mobile directories remain in the root.
- Partially Implemented: `node_modules-install-failed` appears in the repository tree and should not be part of product source.
- Implemented: Root README now identifies `src/` as the active web app, `mobile/` as the active Expo app, and `supabase/` as active database infrastructure.
- Implemented: Root ESLint now excludes confirmed backup/archive folders and generated output from active lint traversal.
- Partially Implemented: Repository-wide lint was previously recorded as failing with 67 errors and 414 warnings. These failures predate this repository stabilization branch, and backup/archive directories contributed heavily to the failure count before the safe exclusions.
- Planned: Remaining lint remediation should be handled in a dedicated stabilization task and should not be mixed with Collector Workspace product work.

## Authentication Problems

- Implemented: Active web and mobile admin access now use `user_roles` as the platform-role authority.
- Implemented: Active web code no longer authorizes admin access from a hard-coded owner email.
- Partially Implemented: Legacy Supabase migrations still contain email-based `is_platform_owner()` functions and policies.
- Implemented: Mobile email/password auth now renders exact Supabase errors, persists remembered-email preferences only when selected, restores sessions before route guards render, and exposes Command Center as an additive protected destination when role lookup succeeds.
- Partially Implemented: Native biometric/session-lock scaffolding remains architecture-only until verified on physical iOS/Android devices.
- Requires Production Configuration: Supabase Auth settings, OAuth callbacks, recovery flow settings, and MFA are not provable from source.

## Navigation Issues

- Implemented: Active mobile tabs now use `mobile/services/navigation-contract.ts` for account-aware labels, hidden routes, prominent tab selection, selected state, and fallback account behavior.
- Implemented: Active mobile tabs now render as one compact bottom navigation bar with exactly five visible tabs per account, consistent Ionicons, safe-area-aware height, and no Explore placeholder route in the active tab group.
- Implemented: Deal Desk is no longer registered as an Expo tab and is retained only as a contextual `/deal-desk` route.
- Implemented: Mobile Home now preserves the bottom tab bar as the only primary navigation system; the Home action row is a compact deep-link surface, not a duplicate persistent nav.
- Implemented: Active web dashboard navigation now uses `src/lib/navigation/contract.ts` and `src/components/dashboard/navigation.ts` for account-aware labels in `TieredDashboardShell` and mobile web bottom nav.
- Implemented: Admin navigation is additive: normal workspaces remain the default, and Command Center stays protected by route guards.
- Partially Implemented: Multiple older navigation definitions still exist in dashboard legacy folders and backup snapshots.
- Partially Implemented: Some canonical labels map to existing workspace shells because dedicated route content is not implemented yet.
- Partially Implemented: Web admin subnavigation is represented by the current Command Center surface rather than dedicated pages for every admin destination.

## Component Duplication

- Partially Implemented: Dashboard shells, topbars, sidebars, workspace frames, metric cards, inventory workspaces, purchasing workspaces, deck vault components, and business operation components have overlapping versions.
- Partially Implemented: Web and mobile now have first-wave TD primitives, but legacy `src/components/ui`, mobile `foundation.tsx`, mobile `primitives.tsx`, `mobile/constants/brand.ts`, and many screen-local style systems still coexist.
- Implemented: Shared semantic tokens and first-wave TD primitives provide a canonical migration target for buttons, cards, inputs, badges, text, screen shells, section headers, loading states, empty states, error states, and dividers.
- Implemented: Mobile adds shared `TDChip`, `TDMetricTile`, and `TDIconRow` primitives and migrates active Collection, Card Detail, Storage, Trade Binder, Wishlist, Scanner, Scanner Session Review, and Profile controls away from duplicated local chip/metric styles.
- Implemented: Mobile design OS now adds canonical `TDIconButton`, `TDListRow`, `TDSheet`, `TDSegmentedControl`, `TDResultTray`, `TDSkeleton`, `TDToast`, `TDStatusIndicator`, `TDNavigationHeader`, `TDScannerGuide`, and `TDSessionStrip` contracts for future mobile screen migrations.
- Partially Implemented: Seller/Signals and Deal Desk now use TD primitives and honest unavailable states, but the rest of the active mobile app still needs staged visual QA rather than blanket migration.
- Implemented: Mobile Design OS Wave 1 migrates the active app shell, Home, Scanner, Collection, Card Detail, and Storage Locations toward the canonical primitives and hierarchy rules.
- Implemented: Mobile Design OS Wave 2 migrates Trade Binder, Wishlist, Scanner Session Review, Deal Desk, Seller/Signals, Profile, Authentication, Welcome, Onboarding, and Plans toward the canonical primitives and hierarchy rules.
- Implemented: Scanner Session Review now uses a simplified finalization hierarchy with four metrics, advanced filter sheet, collapsed non-editing rows, dedicated card review sheet, Review next, and sticky safe-area actions while preserving session calculations.
- Implemented: Mobile Design OS Wave 3 migrates Command Center summary, Settings, Scanner Recovery, and the dev-only design-system showcase while documenting route-by-route final consistency status.
- Planned: Pick a canonical component tree and archive or delete superseded versions after review.

## Potential Bugs

- Implemented: Active web and mobile membership tier names, prices, limits, and plan-card labels now use the canonical `free | collector | seller | store` catalog.
- Implemented: Authenticated collection surfaces no longer present static sample cards as live user data.
- Implemented: Mobile Home no longer presents mock collection value, mock movement, mock signals, or fake recent activity as live user data.
- Implemented: Mobile Home Product V2 now shows one account-aware summary hero, four or fewer quick actions, real Recent Adds from owned collection rows, and one contextual insight.
- Implemented: Mobile Seller/Signals and Deal Desk no longer present static fake revenue, margin, market, budget, or event-name metrics as authenticated business data.
- Implemented: Collector card detail surfaces now support organization actions with optimistic updates and rollback rather than showing read-only planned action cards.
- Partially Implemented: Web `/dashboard/inventory` now uses the Collector Workspace browser; older inventory management components remain in source and need workflow review before retirement.
- Implemented: A forward-only Collector mutation security migration proposal now exists for DB-side ownership and Free-plan total-quantity enforcement, but it is not applied to production.
- Partially Implemented: Native direct Collector writes still need the proposed DB migration applied and replay-verified before production reliance; current web writes enforce the limit through the Next.js mutation API.
- Implemented: Scanner queued adds now replay through a user-scoped worker with generated inventory-id idempotency, so interrupted successful writes can be retried without duplicate inventory insertion.
- Implemented: Scanner intelligence contracts now separate capture, boundary, OCR, artwork, set symbol, collector info, finish detection, printing candidates, and confidence fusion providers.
- Implemented: Multi-TCG scanner contracts now separate game detection, game-specific recognition adapters, universal identity, mixed sessions, universal export rows, and unsupported-card observations.
- Implemented: Magic recognition now has a real adapter and focused tests for Scryfall-backed candidate ranking, exact-printing ambiguity, legal finish validation, missing-signal confirmation, offline cache fallback, privacy defaults, and benchmark non-claims.
- Implemented: Magic scanner calibration now has private fixture manifest validation, ignored local fixture/output paths, sanitized JSON/CSV/Markdown reporting, threshold classification, advisory calibration recommendations, and focused benchmark tooling tests.
- Implemented: Private scanner benchmark builder service and `/dev/scanner-benchmark` route are feature-flagged, local-only, and covered by focused dataset/manifest/privacy tests.
- Partially Implemented: `expo-camera` is installed and configured, but native camera behavior still needs development-build and physical-device QA before production claims.
- Implemented: `expo-dev-client`, VisionCamera, and Nitro dependencies are configured for the live scanner development-build path.
- Implemented: `mobile/services/live-card-recognition.ts` adds synthetic-tested local frame analysis for card bounds, corners, aspect ratio, guide fit, blur, motion, lighting, glare, fingerprints, targeted OCR mapping, and Magic adapter handoff.
- Implemented: `mobile/services/native-scanner-calibration.ts` adds synthetic-tested native QA contracts for camera-ready gating, guide/crop geometry, unavailable-signal blocking, visible capture outcomes, card-removal rearm checks, and evidence-only foil diagnostics.
- Partially Implemented: The active Scan tab now has a native VisionCamera frame-output adapter that feeds bounded luma samples into the analyzer, with Expo Camera retained for web fallback. Physical iOS and Android development-build validation is still pending.
- Implemented: Native iOS Magic OCR v1 adds a local Expo module backed by Apple Vision, guide-assisted crop mapping, OCR normalization, top-three Scryfall matching, confidence caps for title-only observations, and temporary capture deletion.
- Implemented: The local OCR module now includes an Apple podspec so `expo-modules-autolinking resolve --platform apple` emits the `TradingDocksVisionOcr` pod and `TradingDocksVisionOcrModule` registration.
- Implemented: The active Scan tab now uses a premium camera-first hierarchy with compact header, large guide viewport, exactly two primary controls, secondary settings/manual/diagnostics panels, and a compact Review List chip.
- Implemented: Scanner Product V3 now consolidates production scanning into one Trading Docks Scanner entry with Auto Scan ON/OFF capture behavior and Review List post-processing.
- Implemented: Scanner readiness feedback is shared by Auto Scan ON and OFF, with one visible instruction and auto-capture no longer blocked solely by unavailable optional lighting/glare diagnostics.
- Implemented: The unified scanner keeps pricing, confidence, card metadata, condition, finish, and offer math out of the active camera surface while preserving those data paths for Review List.
- Implemented: `/scan/single` is retained as a compatibility alias to the unified scanner instead of a separate production recognition engine.
- Implemented: Scanner Review List finalization now persists collection-destination lines through the canonical scanner confirmation path into `inventory_items` or the user-scoped offline queue instead of only marking the session locally reviewed.
- Implemented: Automatic Scan now uses an explicit geometry-stability state machine so Auto ON invokes the same `captureStill` recognition path when a card is stable, then blocks duplicate same-card captures until removal/rearm.
- Implemented: The active web admin user-management surface can now explicitly save manual membership overrides through the existing `admin_membership_overrides` API path even when the resolved plan already displays the selected tier.
- Planned: Grid Scan remains intentionally disabled until real multi-card recognition and post-processing are benchmarked.
- Implemented: The active scanner is now batch-first intake: supported matches add directly to Scanner Session Review, likely/ambiguous rows are Needs review, failed reads do not create unknown rows, and per-card Add/pricing/metadata controls are no longer rendered on the camera surface.
- Implemented: Magic still-capture OCR now normalizes rotated iPhone captures to the live preview orientation, uses primary/expanded/lower/wide/full-card title OCR fallback regions, exposes development-only crop proof, and keeps failed Retake recovery out of the user-paused camera state.
- Implemented: Scanner 2.0 now has a canonical camera lifecycle model, app background guards, stale manual-search guards, structured Scryfall outcomes, and a dedicated stabilization document.
- Implemented: Normal scanner mode no longer renders development diagnostics inline; diagnostics remain available only through the explicit development flag and panel.
- Implemented: Scanner 2.0 layout simplification removes pause, settings, and diagnostics from the primary control row; diagnostics now opens only from scanner settings when the development flag is enabled.
- Implemented: Scanner 2.0 release-candidate presentation now hides the normal tab bar only on the active Scan route, uses a full-screen camera surface, keeps Torch/Capture as primary controls, moves Manual Search into scanner settings, and converts added/remove-card feedback into transient overlays.
- Partially Implemented: Physical-device scanner QA remains unperformed in this repository; iOS/Android preview scaling, safe areas, capture timing, tab resume, sleeves, glare, and rapid replacement must be verified with `docs/NATIVE_SCANNER_QA.md`.
- Partially Implemented: Batch scanner latency diagnostics are available in the development panel with bounded local history, measured averages, preview/capture resolution when available, sanitized JSON export, bounded public catalog lookup caching, prewarming result reporting, and a development benchmark harness; capture/OCR/Scryfall/session-write budgets and camera FPS still need measured physical-device benchmark runs.
- Implemented: Mobile V1 completion adds Home art-piece composition, physical binder list/page/share/revoke UI, mobile-to-HQ bearer-authenticated binder sharing, child storage-location creation, hierarchy breadcrumbs, scan destination controls, Card Show offer-rate controls, Automatic Scan QA overlay, and compact benchmark export.
- Requires Production Configuration: Physical iOS/Android QA still needs to measure scanner latency, OCR, lookup, session insertion, camera FPS, preview resolution, and capture resolution before production performance claims.
- Partially Implemented: Scanner price enrichment now uses Scryfall price metadata after Review List insertion, but provider freshness, normalized price history, stale-price display, and failure telemetry still need product and data-model review.
- Implemented: Scanner camera framing now uses a safe-area-aware helper so the 63:88 guide avoids the compact header, bottom controls, and device insets in source-tested viewport cases; still capture settings are centralized at maximum quality with native orientation processing and supported iOS responsive orientation.
- Implemented: Scanner camera selection now separates camera mode from zoom, normalizes legacy `macro` to `close`, hides duplicate no-op fixed modes, remounts when the resolved device/profile changes, and exposes development-only Camera QA cycling.
- Partially Implemented: The actual Auto/Close-up/Standard/Telephoto camera inventory must still be measured on physical iOS/Android devices; no repository-only test can prove the device hardware mapping.
- Partially Implemented: The premium scanner UI still depends on manual still capture until native frame delivery is validated on devices.
- Partially Implemented: Rapid Scan has source-tested throughput contracts, live-frame state handling, iOS native frame-title OCR, bundled local Magic title identity, staged title ROIs, bounded retry, and development diagnostics, but physical benchmark evidence and live exact-printing refinement are still required before it can replace still-photo Precision capture broadly.
- Partially Implemented: Physical-device testing still shows readable Magic cards such as Goblin War Strike can fail in the scanner, confirming the captured-still OCR/local-catalog path needs Golden 50 validation before reliability claims. Experimental Rapid, visual-descriptor, pHash, Feature Print, and fusion paths remain lab-only until benchmark evidence supports production use.
- Implemented: The iOS preview/Release build now applies a generated Podfile workaround scoped only to the `VisionCamera` pod, setting Release Swift optimization to `-Onone` and compilation mode to `singlefile` because Xcode 26 / Swift 6.2 can ICE while compiling VisionCamera V5/Nitro Swift sources. Remove this after upstream VisionCamera/Nitro or the EAS Xcode toolchain fixes the Release compiler crash.
- Planned: `docs/SCANNER_AUTO_CAPTURE_NATIVE_PLAN.md` records the required native frame bridge, measured FPS, auto-capture gate, same-card removal/rearm, privacy, physical QA, and rollback criteria before hands-free capture can be enabled.
- Partially Implemented: Magic visual recognition still lacks benchmarked accuracy, artwork embedding, set-symbol detection, true perspective-warp output, Android OCR, and finish classification providers. The active UI must continue requiring confirmation.
- Partially Implemented: The benchmark builder captures and labels fixtures, but native image file movement/deletion must still be verified on physical iOS/Android development builds before relying on it for production calibration collection.
- Partially Implemented: Native scanner replay still lacks a standalone network reachability trigger; without an approved reachability dependency it retries on app resume, session restore, and manual retry while Expo Web also uses the browser reconnect event.
- Partially Implemented: Inventory remains Magic-production-first, but the multi-TCG identity proposal is now additive and production-safe after backup/staging replay. Pokemon remains beta for catalog import, marketplace export, and scanner recognition reliability.
- Partially Implemented: Mobile/web parity still has gaps for active workspace authority, Store/team shared inventory, mobile Deck Vault, and seller/store operational data. Current status is documented in `docs/MOBILE_WEB_DATA_PARITY.md`.
- Partially Implemented: Collection price display depends on positive saved inventory value fields and shows unavailable when those fields are missing or defaulted to zero.
- Partially Implemented: Purchase History has been upgraded from a placeholder into the canonical acquisition-ledger surface, but only Bulk Buying currently writes through the new API and the Supabase schema remains a proposal until reviewed and applied.
- Requires Production Configuration: Supabase billing, trial, override, and feature-access schema constraints still need a reviewed migration from legacy `business` to canonical `store`.
- Implemented: Mobile production identifiers now use `com.tradingdocks.app` for iOS and Android.
- Implemented: Mobile production-release verification now checks identifiers, app version/build metadata, EAS profile presence, forbidden public secrets, development flags, and required production Supabase public env when run with `NODE_ENV=production`.
- Partially Implemented: Mobile account deletion is visible and support-assisted; backend self-service deletion remains Planned.
- Partially Implemented: Mobile RevenueCat purchase and Restore Purchases entry points are implemented, and a trusted server webhook now reconciles authenticated RevenueCat events into provider state plus canonical membership. Paid access remains blocked until the migration is applied in staging/production, the RevenueCat dashboard webhook is configured, and Sandbox purchase/restore QA passes.
- Requires Production Configuration: `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`, server-only `REVENUECAT_WEBHOOK_AUTHORIZATION`, RevenueCat Offering packages, RevenueCat webhook URL, Apple Sandbox purchase/restore QA, and approved release validation are required before paid mobile subscription release.
- Partially Implemented: Some API allowlisted endpoints may expose expensive external calls without durable rate limiting.
- Partially Implemented: Multiple migration repair files may not replay cleanly in a fresh database without manual sequencing review.

## Security Concerns

- Requires Production Configuration: Rotate any secrets that were ever committed or pasted outside secure stores.
- Requires Production Configuration: Validate Stripe, Supabase, Cloudflare, Resend, Vercel, and marketplace settings in staging.
- Partially Implemented: Cross-account isolation is documented but not automated in CI.
- Planned: Add durable rate limiting and observability.
- Requires Production Configuration: The new Apple Vision local module requires a fresh EAS iOS development build before product-owner physical QA.

## Architecture Improvements

- Planned: Establish canonical web dashboard architecture.
- Implemented: Establish a shared membership contract for web, mobile, admin, Stripe adapter code, and future RevenueCat adapter planning.
- Implemented: Add a centralized mobile RevenueCat service that keeps Supabase UUID as `appUserID`, maps `Collector`/`Seller`/`Store` entitlements into canonical tiers, and keeps provider purchase state separate from backend authorization.
- Implemented: Shared identity/access types now separate platform role, account type, membership tier, billing status, and entitlements.
- Planned: Generate a canonical Supabase schema snapshot from a clean migration replay.
- Partially Implemented: The acquisition ledger now provides a single Purchase History contract across inbound buying workflows; remaining work is to connect the other finalized intake surfaces after staging schema verification.
- Partially Implemented: `docs/REPOSITORY_CLEANUP_PLAN.md` now inventories historical backups, generated output, duplicate dashboard systems, duplicate navigation, duplicate design-system layers, unused candidates, and cleanup phases.
- Planned: Move historical release notes/backups out of active source after product-owner review.
- Planned: Continue incremental design-system migration rather than sweeping every screen into the new primitives at once.
- Implemented: `docs/MOBILE_PRODUCT_DESIGN_AUDIT.md`, `docs/TRADING_DOCKS_DESIGN_BIBLE.md`, `docs/MOBILE_COMPONENT_CONTRACTS.md`, `docs/MOBILE_ACCESSIBILITY_STANDARD.md`, `docs/MOBILE_MOTION_STANDARD.md`, and `docs/MOBILE_VISUAL_MIGRATION_PLAN.md` now define the mobile design OS and migration order.
- Implemented: `docs/HOME_PRODUCT_V2.md` and `docs/SCANNER_CAMERA_SELECTION.md` document the active mobile Home and camera-selection contracts.
- Planned: Apply the mobile design OS screen-by-screen after physical-device QA confirms touch targets, safe areas, larger text, and reduced-motion behavior.
- Planned: Deprecate duplicated dashboard navigation modules only after active imports are audited and route content gaps are prioritized.

## Performance Opportunities

- Implemented: Collector Workspace search is debounced, mobile rendering uses `FlatList`, and data loaders cap reads with `COLLECTION_PAGE_SIZE`.
- Implemented: Mobile Collection search now resolves matching `inventory_locations` IDs in a user-scoped query and includes those locations in the inventory search filter.
- Planned: Add cursor-based pagination and server-side filter endpoints for large collections.
- Planned: Audit large client components for bundle size and split heavy dashboard workspaces.
- Planned: Cache safe public card data with explicit provider limits and invalidation rules.
- Planned: Replace duplicate component systems with shared primitives to reduce CSS/runtime weight.
- Planned: Use shared loading, empty, and error states to reduce repeated rendering logic and bespoke animation code.
- Partially Implemented: Mobile default card padding/radius is now more compact, but native performance and visual measurement still need device validation.

## Missing Tests

- Implemented: Focused mobile auth tests cover email/password success and failure, session restoration, admin routing, normal routing, remembered email, and keep-me-signed-in discard behavior.
- Implemented: Focused mobile design-system tests cover token exports, semantic colors, button disabled/loading behavior, input error state, and accessibility metadata.
- Implemented: Focused mobile design-system tests now cover selectable control accessibility, minimum touch target constants, and zero negative tracking for mobile display/heading typography.
- Implemented: Focused mobile navigation/auth contract tests cover protected-route loading, Collector/Seller/Store tab labels, five-tab composition, no Explore placeholder tab, center-action reachability, safe-area sizing, admin route access, normal-user admin denial, fallback account type, and selected tab state.
- Implemented: Focused native Magic OCR tests cover native-module interface validation, unsupported-platform behavior, guide-to-capture mapping, OCR response mapping, title normalization, collector parsing, candidate ordering, confidence caps, cleanup, and scanner-session insertion preparation.
- Implemented: Focused Rapid identity tests cover bundled Magic catalog prewarm, Incinerate and representative local matches, conservative OCR fuzzy variants, card-relative-to-full-frame title ROI conversion, Vision bottom-left ROI conversion, staged title ROI fallback, catalog-not-ready retry, bounded Precision fallback, and Single Scan local identity fallback.
- Implemented: Focused multi-signal recognition tests cover production-scale descriptor-index loading, regression-card coverage, descriptor metadata, visual-fingerprint plus weak OCR identity, OCR-assisted visual narrowing, OCR-only review behavior, visual/OCR conflict review behavior, unusable-frame rejection, best-frame selection, printing refinement after identity, and benchmark comparison without fake compact-embedding measurements. These tests protect the development lab, not production scanner authority.
- Implemented: Focused identity/access tests cover owner, admin, support, analyst, normal user, missing role, suspended account, admin with Free membership, Seller without admin role, and authorized/unauthorized web admin route decisions.
- Planned: Auth redirect and callback tests.
- Implemented: Focused membership entitlement tests cover prices, annual savings, limits, financial access, Deal Desk access, web workspace access, Store employee entitlement, role separation, billing fallback, and unknown-tier fallback.
- Implemented: Focused Collector Workspace tests cover search filtering, sorting, exact-printing display, storage-location display, trade-binder indicator, wishlist indicator, Free card-limit behavior, empty state, no-results state, and safe missing-price behavior.
- Implemented: Focused Collector mutation tests cover ownership rejection, Free-plan limits, quantity validation, condition/finish/storage/trade/wishlist optimistic updates, rollback, trade-filter visibility, user-isolated offline queue entries, and duplicate queued-write prevention.
- Implemented: Collector mutation tests now cover recognition of proposed database-authoritative ownership and Free-limit errors for offline replay.
- Implemented: Collector Workspace tests now cover cursor construction, end-of-results state, duplicate page merging, search/filter/sort reset keys, stale response rejection, and exact-printing preservation.
- Implemented: Focused Storage Location Manager tests cover create payloads, hierarchy paths, search, cards-in-location, unassigned cards, archive-with-assigned-card rejection, cross-user rejection, recent/favorite ordering, assignment validation, missing-location fallback, invalid parent relationships, and offline assignment dedupe keys.
- Implemented: Focused Trade Binder/Wishlist tests cover binder search/filters, status updates, wishlist add/remove semantics, priority updates, exact/flexible matches, condition/finish mismatch rejection, quantity handling, storage search, optimistic rollback data, offline de-dupe keys, user isolation, empty state, and no-results state.
- Implemented: Focused scanner tests cover permission denied/unavailable states, manual fallback, exact-printing selection, quantity validation, Free-plan limit response, storage assignment payloads, Trade Binder status, Wishlist action, rapid reset, offline queue keys, failed-save rollback shape, user isolation, no image retention by default, and interrupted draft recovery.
- Implemented: Focused scanner replay tests cover offline queued add shape, reconnect/app-resume/session-restore triggers, user-switch isolation, duplicate interrupted-success replay, successful queue removal, failed/action-required visibility, Free-limit errors, unauthorized replay stops, retry one, retry all, confirmed discard, and exact-printing preservation.
- Implemented: Focused scanner intelligence tests cover region extraction contracts, missing/conflicting signals, exact-printing ordering, explainable confidence, low-confidence confirmation, foil contract limitations, legal finish validation, duplicate idempotency, session totals, destinations, CSV export, missing prices, benchmark non-claims, and no image retention defaults.
- Implemented: Focused multi-TCG scanner tests cover Magic/Pokemon/One Piece/Lorcana classification, unknown-card rejection, manual game correction, adapter routing, game-specific metadata preservation, mixed-session totals, universal and separated export, finish taxonomy validation, unsupported finish rejection, user-scoped session recovery, universal inventory contracts, no image retention, and benchmark non-claims.
- Implemented: Focused Magic recognition tests cover exact name and collector-number matching, ambiguous names, multiple reprints, missing collector number, conflicting set/collector signals, legal and illegal finishes, double-faced layout cues, unsupported/token rejection, top-three ranking, manual fallback, privacy/no-retention defaults, Scryfall failure, offline cached candidates, Magic adapter routing, and fixture-metric non-claims.
- Implemented: Focused Magic scanner benchmark tests cover manifest validation, missing expected fields, top-1 scoring, top-3 scoring, false high-confidence detection, latency reporting, unsupported-card fixtures, private path exclusion, no image output in reports, and threshold classification.
- Implemented: Focused scanner benchmark builder tests cover feature-flag disabling, dataset create/resume/recovery, exact-printing requirements, stable fixture ids, duplicate prevention, edit/retake/remove/delete flows, local-only paths, no-upload behavior, incomplete reporting, summary counts, benchmark-ready state, native runner fallback, and privacy acknowledgment.
- Implemented: Focused native scanner calibration tests cover diagnostics gating, local calibration clamps, guide/crop mapping, unavailable-signal auto-capture blocking, camera-ready capture blocking, visible capture outcomes, duplicate/removal rearm, session outcome diagnostics, and non-claiming foil evidence.
- Implemented: Focused premium scanner experience tests cover diagnostics separation, failed OCR recovery without unknown-session insertion, batch Review List chip behavior, high-confidence/likely/ambiguous review-state rules, three-control scanner layout, compact header models, pipeline state mapping, text-plus-color guide states, and high-volume defaults without auto inventory insertion.
- Implemented: Focused mobile Home composition tests cover Free, Collector, Seller, Store, empty portfolio, missing movement data, active session visibility, unavailable signal data, one primary navigation system, and bottom-navigation spacing contract.
- Implemented: Focused mobile product design tests cover the mobile design OS documentation set and guard against fake business metrics returning to active Seller/Signals and Deal Desk routes.
- Implemented: Focused mobile product design tests now verify Wave 1 route source contracts for shell navigation, Home, Scanner, Collection, Card Detail, and Storage Locations.
- Implemented: Focused mobile product design tests now verify Wave 2 route source contracts and guard Welcome/Plans against fake metrics or unsupported employee-seat claims.
- Implemented: Focused mobile product design tests now verify Wave 3 docs, admin/settings/recovery/showcase hierarchy, scanner diagnostic gating, and no idempotency details in normal recovery UI.
- Implemented: Focused Mobile V1 tests cover exactly five tabs, no primary Deal Desk tab, storage-aware collection search, shared physical-binder contract parity, first-ready-frame auto-capture, and admin manual override UI behavior.
- Planned: Route-level entitlement tests beyond the canonical contract.
- Planned: Billing webhook tests with signature and idempotency cases.
- Implemented: Focused RevenueCat membership tests cover Supabase UUID identity, logout/account switching, entitlement precedence, package/product mapping, localized pricing usage, restore/purchase UI contracts, Stripe compatibility language, and no client-side entitlement escalation.
- Planned: Public share token validation tests.
- Planned: API route authentication allowlist tests.
- Planned: Supabase RLS/cross-account isolation tests.
- Planned: Mobile auth/session/offline queue tests.
- Planned: Native device tests for biometric unlock and OAuth/magic-link callback handling.

## Documentation Gaps

- Partially Implemented: Historical docs exist as release notes, not durable architecture docs.
- Partially Implemented: Mobile README is still mostly default Expo text.
- Implemented: `docs/DESIGN_SYSTEM.md` now records the current design-system source of truth, audit findings, token naming, component usage, migration strategy, web/native differences, deprecated patterns, and remaining design-system debt.
- Implemented: Mobile product design documentation now records the current route audit, visual language, component contracts, accessibility rules, motion rules, and staged migration plan.
- Planned: Add a canonical environment variable matrix.
- Planned: Add provider setup runbooks for Stripe, Supabase, Cloudflare, eBay, Mana Pool, Resend, Vercel, and mobile app store builds.

## Recommended Sprint 1

1. Freeze new product features until architecture and membership contracts are reviewed.
2. Review `docs/REPOSITORY_CLEANUP_PLAN.md` and approve the cleanup classification before deleting or archiving anything.
3. Remove generated dependency/build artifacts in a dedicated cleanup PR after review.
4. Continue from the new canonical navigation contracts by auditing legacy dashboard imports and deciding which old navigation modules can be retired.
5. Review the new canonical membership catalog and approve Store employee-capacity configuration.
6. Audit API authentication and entitlement enforcement endpoint by endpoint.
7. Replay Supabase migrations in a fresh staging project and record the canonical schema.
8. Add CI coverage for auth, plan gates, billing webhooks, public share safety, API allowlists, mobile TypeScript, mobile tests, and Expo web export.
9. Continue design-system migration through shared dashboard states and common cards before attempting modal primitives.

## Recommended Identity Sprint 1

1. Draft and review a Supabase migration that replaces `is_platform_owner()` policies/functions with `user_roles`/`is_admin()`.
2. Replay migrations in staging to confirm `user_roles`, `admin_audit_log`, `admin_membership_overrides`, and billing tables converge cleanly.
3. Draft and review a Supabase migration replacing legacy `business` membership values and constraints with canonical `store`.
4. Add route-handler tests for privileged admin API permissions once a Next route test harness is configured.

## Recommended Membership Sprint 1

1. Review and approve the canonical plan catalog in `mobile/services/membership-catalog.ts`.
2. Verify Stripe price IDs match Collector $4.99/$49.99, Seller $14.99/$149.99, and Store $49.99/$499.99 before live billing.
3. Draft the `business` to `store` Supabase migration for billing subscriptions, admin overrides, trials, account plans, feature access, and admin helper functions.
4. Add endpoint-level entitlement enforcement tests for billing, admin overrides, and protected dashboard APIs.

## Recommended Navigation Sprint 1

1. Verify route content for labels marked Partially Implemented, especially mobile Store Business/Activity, mobile Signals, web Trade Binder, web Deal Desk, and web admin subareas.
2. Verify web and mobile admin navigation after the shared `user_roles` authority change.
3. Add server-side entitlement tests for dashboard routes so hidden navigation never becomes the only access control.
4. Retire unused sidebars and navigation definition files after confirming no active imports.

## Recommended Collector Organization Sprint 1

1. Review the proposed DB-side Free-plan enforcement path for native direct writes and offline replay.
2. Add integration tests around the Next.js Collector mutation route once route-handler fixtures are available.
3. Add native manual QA for failed mutation rollback, queued offline mutation replay, sign-out/user-switch isolation, and stale cached collection detail.
4. Decide whether condition and finish should remain JSON payload fields or become first-class columns in a reviewed schema migration.
5. Replay `202608050001_collector_mutation_security_proposal.sql` in staging and run `verify_collector_mutation_security.sql` before production approval.
6. Install or use approved disposable Supabase tooling for a clean migration replay; the current Codex environment has no `supabase`, `psql`, or Docker binary available.
7. Verify service-role inventory import behavior before production rollout; current audit found read-oriented service-role inventory access, while authenticated client/bulk upsert paths will be subject to the proposed trigger.
8. Run staging query-plan review for large Collector datasets, especially `ilike` search, JSON condition/finish filters, Trade Binder/Wishlist related filters, and price/quantity sorts.
9. Add web table virtualization and mobile `FlatList` tuning once realistic collection-size fixtures are available.

## Recommended Storage Location Sprint 1

1. Review the proposed storage hierarchy migration before production reliance on parent/child constraints, archived columns, favorites, and recent-location indexes.
2. Add route-handler or RPC-backed storage mutations if direct table writes become insufficient for workspace/store inventory sharing.
3. Add a visible mobile offline conflict-resolution surface for failed queued storage assignments.
4. Validate large-location manager performance with realistic location counts and card-count aggregations.

## Recommended Trade Binder/Wishlist Sprint 1

1. Decide whether wishlist exact printing requires `collector_number`, `language`, or `scryfall_id` columns before trade-calculator work begins.
2. Add production route/API tests for Trade Binder and Wishlist mutations once route-handler fixtures are available.
3. Add a dedicated offline conflict-resolution surface for failed Trade Binder and Wishlist queued writes.
4. Design trade-calculator and card-show prep flows as consumers of the current `TradeBinderItem`, `WishlistItem`, and `WishlistMatch` contracts.

## Recommended Scanner Sprint 1

1. Run physical-device camera QA for iOS and Android development builds, including permission denial, torch, capture latency, retake, cache behavior, and Expo Web fallback.
2. Approve an OCR/image-recognition provider and privacy/retention policy before enabling photo upload.
3. Review Pokemon, One Piece, and Lorcana catalog licensing/API options and decide whether catalogs are server-hosted, provider-hosted, or cached.
4. Draft a universal inventory schema proposal that preserves existing Magic rows and supports external provider ids by game.
5. Collect labeled scanner benchmark fixtures before publishing any game-detection, printing, finish, foil, or latency claims.
6. Use the feature-flagged benchmark builder to collect a reviewed starter dataset, then run `npm run benchmark:magic-scanner -- --manifest <private-manifest.json>` before lowering manual-confirmation friction.
7. Add an approved native reachability dependency or platform monitor if scanner replay must trigger immediately on native reconnect while the app remains foregrounded.
8. Add scanner-to-Deal Desk and card-show prep integrations only after the validated confirmation contract is reviewed.
9. Validate the continuous scanner on physical devices; current implementation includes the state machine, guide geometry, offer session, duplicate protection, CSV serialization, and local frame analysis, but native camera frame delivery plus OCR/artwork/foil providers are still pending.
10. Validate VisionCamera frame delivery, auto-capture, same-card removal, and OCR handoff on physical iOS/Android development builds before changing confirmation friction.
## Scanner 2.0 Health Notes

Status: Implemented / Partially Implemented.

Implemented improvements:

- Scanner route has named presentation components instead of one giant render tree.
- Camera starts automatically when permission is granted.
- Failure UI is compact and does not expose Scryfall or OCR exception text.
- Scanner lookup details are confined to development diagnostics.
- Immersive release-candidate scanner docs are captured in `docs/IMMERSIVE_SCANNER_RELEASE_CANDIDATE.md`.
- Capture path now guards against duplicate capture and stale lookup completion.
- Missing HUD values use a compact dash rather than long unavailable copy.

Remaining risks:

- Physical-device QA is still required for camera preview framing, haptics, and Dynamic Island behavior.
- Native card-presence/removal signals are still limited by available provider data.
- Auto-accept in high-volume mode remains disabled until product safety rules and benchmark evidence support it.
- Full recognition accuracy and foil recognition remain unclaimed.

## Mobile Release Candidate Health

Status: Partially Implemented.

Implemented improvements:

- Root mobile launch now uses branded workspace restoration instead of a floating spinner.
- Unauthenticated welcome copy is compact, product-scoped, and no longer exposes a preview bypass or fake metrics.
- Auth-facing errors are sanitized for customers while internal diagnostics continue to avoid passwords, tokens, and secrets.
- Onboarding captures account intent without forcing paid plan purchase.
- Legacy `/experience` fake demo metrics were removed from the active route surface.
- Mobile plan copy no longer names internal billing providers or implies paid mobile purchase is ready.
- Release audit, billing architecture, privacy audit, and store checklist docs were added.

Current release blockers:

- Physical-device QA remains incomplete for iOS, Android, native camera/OCR, scanner replay, accessibility, larger text, and user switching.
- Mobile paid subscription architecture is not approved or implemented; paid in-app digital access must be StoreKit/Google Play compliant.
- Production builds still need explicit validation that development routes and scanner diagnostics are not exposed.
- Physical-device Rapid Scan QA must confirm the title ROI overlay is aligned on real hardware and that Incinerate emits a session result before scanner throughput claims are made.
- Store/legal assets are incomplete: privacy URL, terms URL, support URL, delete-account policy, App Privacy, Play Data Safety, screenshots, and review notes.

Recommended next release sprint:

1. Run the full physical QA matrix from `docs/MOBILE_STORE_RELEASE_CHECKLIST.md` and record results without estimating performance or scanner accuracy.
2. Decide whether TestFlight includes paid upgrades. If yes, build the approved mobile billing provider; if no, keep paid purchase UI disabled.
3. Add automated production-gate assertions for `/dev/*`, scanner diagnostics, benchmark builder, and design showcase.
4. Add a production error boundary and route-level recovery copy.
5. Confirm store metadata, support/legal URLs, and account deletion policy with product owner/legal.

## Platform Authority Health

Status: Partially Implemented.

Implemented improvements:

- Added a typed platform access model and capability registry.
- Added route, client, server, and API guard adapters.
- Migrated active dashboard route classification and protected API authorization checks to the platform access contract where capabilities apply.
- Added tests preventing new active `business` tier branching, duplicate capability registries, and email-based admin authority in active authority files.
- Added tests requiring active dashboard pages and API route handlers to be explicitly classified.

Remaining risks:

- Historical/display helper modules such as legacy tier and dashboard entitlement utilities still exist and should be retired only after import audits.
- Webhook and server-only API routes remain deliberately outside user capability guards and require route-local authorization review.
- Unmapped dashboard routes fail closed until classified.
- Historical Supabase SQL still includes email-based owner helper behavior and requires a reviewed forward-only migration.
- Workspace role semantics exist in the access model, but Store employee permissions need product-owner confirmation before broad rollout.
- RLS still needs the previously proposed Free total-card limit enforcement before direct mobile/offline writes are production complete.

Recommended next stabilization task:

1. Add route-handler integration fixtures for 401/403 API behavior.
2. Audit webhook, OAuth callback, cron, and server-only routes for route-local authorization and rate limiting.
3. Retire or quarantine legacy access helper modules after import ownership is confirmed.
4. Draft the `user_roles` SQL helper migration and staging verification plan.
5. Audit all admin APIs for platform role scope, support/analyst permissions, and override logging.

## Label Studio And Inventory QR Health

Status: Partially Implemented.

Implemented improvements:

- Added typed platform contracts for workspace-scoped SKUs, QR tokens, sanitized public views, label templates, bulk print rendering, repricing review, and POS lookup identity.
- Added `Label Studio` route classification and shared capability names instead of ad hoc plan checks.
- Wired the staging-applied schema into the web Label Studio API, public QR route, and browser printing flow.

Remaining risks:

- Active inventory is still user-owned, while Store Label Studio workflows require workspace-owned inventory identity.
- Production still needs explicit approval before relying on the staging-applied workspace SKU, QR token, template, print-job, and repricing schema.
- The public `/q/{token}` route is implemented through the sanitized Supabase resolver for staging review; disabled/revoked QR behavior still needs browser QA.
- Browser printing still needs real label-stock QA for pagination, margins, scaling, and roll/sheet output.
- Mobile QR mode and future POS mutations require server-side authorization and should not be built as UI-only guards.

Recommended next stabilization task:

1. Complete staging browser QA for Label Studio persistence, QR resolution, print jobs, repricing review, and cross-workspace denial.
2. Add QR route-handler integration tests for public, employee, cross-workspace, revoked-token, and missing-token behavior.
3. Verify Label Studio print CSS on representative 2 x 1, 3 x 2, and 4 x 2 label stock.
4. Map legacy inventory components that already expose SKU-like fields before production bulk print rollout.

## Deck Architect Health

Status: Deck Suite Integration Implemented.

Implemented improvements:

- Added a scoped Deck Architect route, navigation entry, deterministic engine modules, and source-contract tests.
- Kept user-owned collection loading server-side and scoped by authenticated Supabase user id.
- Avoided fake AI, copied third-party deck recommendations, or external-provider claims in the first surface.
- Removed customer-facing internal engine language from the active page and replaced it with workflow, deck, card, and recommendation states.
- Added broader existing-inventory metadata mapping for card images and card facts without duplicating catalog data or changing schemas.
- Added Trading Docks-authored Pauper archetype profiles, Commander strategy inference, card-role classification, legality validation, ranked build opportunities, owned substitutions, and recommendation confidence/provenance tests.
- Added a shared Deck Suite adapter layer so Architect, Builder, Vault, import, export, and analysis handoffs use the existing Deck Vault `DeckRecord` rather than parallel deck models.
- Added Architect -> Builder and Builder -> Architect navigation through existing Deck Vault persistence and user-scoped deck id loading.
- Added potential commander search through the supported card-search path, with not-owned commanders reflected in missing-card summaries.

Remaining risks:

- The first recommendation layer is deterministic and local. External archetype, combo, EDHREC, and provider-backed knowledge sources are not active yet.
- Structured proposal persistence, atomic apply/revert workflows, provider freshness checks, and deeper deck-history controls are still planned.
- Commander candidate quality still depends on type-line metadata being present in saved inventory or catalog payloads.
- Price-aware scoring only uses saved inventory values when available; missing prices stay unavailable.

Recommended next stabilization task:

1. Add route-level integration tests for signed-out redirect and user-scoped collection loading.
2. Add saved proposal tables or a reviewed non-destructive persistence plan before enabling apply/revert flows.
3. Add provider-backed format legality and archetype-template adapters with source attribution.
4. Expand browser QA for empty collection, large collection, mobile-width dashboard, and Owner/Admin access.
