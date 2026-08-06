# Mobile Visual Migration Wave 1

Status: Implemented as the execution map for the first high-traffic mobile design OS migration.

## Scope

Wave 1 covers the active Expo app shell, Home, Scanner, Collection, Card Detail, and Storage Locations. It preserves authentication, Supabase schemas, billing, memberships, scanner OCR/native module registration, Scryfall lookup, collection mutations, offline queues, session persistence, offer math, and account-aware navigation.

## App Shell

- Hero: one balanced five-tab bottom navigation system.
- Primary action: the account-aware center tab, Scan for Free/Collector and Deal Desk for Seller/Store.
- Supporting information: selected tab state, short labels, safe-area padding, and active/inactive icons.
- Deferred information: admin entry, settings, secondary routes, and diagnostics stay outside the primary tab bar.
- Components used: Expo Router `Tabs`, Ionicons, centralized visual model from `mobile/services/navigation-contract.ts`.
- Responsive behavior: equal-width cells, 22 px icons, one-line labels, no floating outer blob, and bottom inset from the safe area.
- Empty/loading/error states: unresolved account navigation renders a loading state before tabs evaluate.
- Accessibility requirements: tab role, selected state, labels, minimum 48 px touch target, and restrained haptic feedback.
- Acceptance criteria: exactly five visible tabs per account, no Explore tab, no clipped labels at 320 px, no content overlap, and route authority unchanged.

## Home

- Hero: one current account/work summary answering what matters now.
- Primary action: one account-aware next step, with scanner and collection entry points still obvious.
- Supporting information: collection count/limit, portfolio/storage/wishlist context, active session, stale/unavailable state, and concise activity/status.
- Deferred information: market movement, orders, notifications, operations signals, and recent activity stay honest unavailable states until real sources exist.
- Components used: `TDNavigationHeader`, `TDCard`, `TDMetric`, `TDListRow`, `TDBadge`, `TDButton`, `TDSkeleton`, `TDEmptyState`, `TDErrorState`, `TDStatusIndicator`.
- Responsive behavior: one hero, compact row actions, no secondary navigation bar, no horizontal scroll, long workspace names wrap.
- Empty/loading/error states: loading skeleton for summary, zero-collection state, stale badge, and unavailable copy with no fake metrics.
- Accessibility requirements: header before actions, icon labels, readable status text, safe bottom inset, and large-text friendly rows.
- Acceptance criteria: account-aware composition for Free/Collector/Seller/Store, one primary action, real data only, scanner and collection reachable.

## Scanner

- Hero: dominant camera viewport aligned with OCR crop mapping.
- Primary action: Capture.
- Supporting information: compact mode/session header, one instruction, Torch, Capture, Search, compact result/failure tray, and compact session strip.
- Deferred information: diagnostics, settings, manual search, candidate details, full history, export, and privacy guidance remain in sheets or secondary routes.
- Components used: existing scanner presentation components plus `TDResultTray`, `TDScannerGuide`, `TDSessionStrip`, `TDIconButton`, `TDSheet`, `TDButton`, `TDText`.
- Responsive behavior: camera-first layout, no horizontal overflow, narrow-phone safe action row, result tray does not cover bottom navigation.
- Empty/loading/error states: permission, unavailable camera, failed recognition, retake, searching, and queued-sync states remain visible and compact.
- Accessibility requirements: current primary camera controls use labeled Torch and Capture actions, text plus color for status, reduced-motion support, and no diagnostics announced inline.
- Acceptance criteria: no Open Camera step, no Resume Camera unless explicitly paused, failed scan creates no unknown row, Retake resumes, OCR/Scryfall behavior unchanged.

## Collection

- Hero: dominant search and inventory result quality.
- Primary action: search collection.
- Supporting information: compact owned/unique/storage/missing-price metrics, small filters/sort, list/grid toggle, card image, name, set, quantity, condition, finish, and storage.
- Deferred information: Trade Binder, Wishlist, Storage, advanced filters, imports, and exports stay secondary.
- Components used: `TDScreen`, `TDNavigationHeader`, `TDInput`, `TDMetric`, `TDSegmentedControl`, `TDIconButton`, `TDListRow`, `TDBadge`, `TDEmptyState`, `TDErrorState`, `TDLoadingState`, `TDSkeleton`.
- Responsive behavior: no desktop table feel, no large filter blocks, compact pagination, two-column grid only when it remains readable, long card names wrap.
- Empty/loading/error states: loading, empty, no-results, retry, stale/offline, loading-more, and end-of-results states remain explicit.
- Accessibility requirements: image labels, list/grid button labels, selected states, no color-only status, and touch targets.
- Acceptance criteria: server-side search/filter/sort/pagination preserved, no fake prices, no horizontal scroll, missing images polished.

## Card Detail

- Hero: card image and identity.
- Primary action: context-aware organization action for the current ownership state.
- Supporting information: printing, value summary, quantity, condition, finish, language, storage, Trade Binder, Wishlist, pending/offline state.
- Deferred information: raw Scryfall id, future scanner/portfolio/deck integrations, and advanced details.
- Components used: `TDNavigationHeader`, `TDCard`, `TDMetric`, `TDListRow`, `TDChip`, `TDBadge`, `TDButton`, `TDStatusIndicator`, `TDEmptyState`, `TDErrorState`, `TDLoadingState`.
- Responsive behavior: image stays centered with max width, long card names wrap, controls are grouped progressively instead of equal-weight grids.
- Empty/loading/error states: loading card, card unavailable, not found, mutation failed, and offline queued states remain visible.
- Accessibility requirements: image label, mutation action labels, selected state for chips, alert semantics for mutation errors, and readable long names.
- Acceptance criteria: mutations and rollback preserved, no destructive zero behavior invented, no giant form appearance.

## Storage Locations

- Hero: fast location search and selected path.
- Primary action: create or assign a location depending on state.
- Supporting information: hierarchy rows, favorites, recent locations, counts, unassigned cards, archived locations, and assigned card lists.
- Deferred information: scan-to-location integration, archive details, rename/create fields, and advanced hierarchy editing.
- Components used: `TDNavigationHeader`, `TDInput`, `TDListRow`, `TDMetric`, `TDSegmentedControl`, `TDBadge`, `TDButton`, `TDEmptyState`, `TDErrorState`, `TDLoadingState`, `TDStatusIndicator`.
- Responsive behavior: structured rows instead of giant cards, nested paths wrap, counts stay readable, and actions stack on narrow widths.
- Empty/loading/error states: no locations, no selected location, no cards assigned, stale/offline, pending sync, archive restriction, and update failed.
- Accessibility requirements: selected location state, clear action labels, status text plus color, and safe bottom clearance.
- Acceptance criteria: ownership-scoped behavior preserved, archive restrictions remain clear, offline assignment behavior preserved, no excessive borders.

## Wave 1 Verification

- Focused lint after each screen checkpoint.
- Focused tests for shell/Home, Scanner, Collection/Card Detail, and Storage.
- Full mobile tests after shared primitives or route migrations.
- Expo Web export, Expo config validation, `expo install --check`, Apple OCR autolinking search/resolve, and `git diff --check` before final checkpoint.
