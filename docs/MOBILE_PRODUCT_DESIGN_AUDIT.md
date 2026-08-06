# Mobile Product Design Audit

Status: Implemented as the current-state audit for the active Expo mobile app on `codex/trading-docks-os-ultimate-polish`.

## Audit Scope

Active mobile app paths reviewed:

- `mobile/app/(tabs)/_layout.tsx`
- `mobile/app/(tabs)/index.tsx`
- `mobile/app/(tabs)/collection.tsx`
- `mobile/app/(tabs)/scan.tsx`
- `mobile/app/(tabs)/deal-desk.tsx`
- `mobile/app/(tabs)/sell.tsx`
- `mobile/app/(tabs)/profile.tsx`
- `mobile/app/auth.tsx`
- `mobile/app/collection/[cardId].tsx`
- `mobile/app/storage-locations.tsx`
- `mobile/app/trade-binder.tsx`
- `mobile/app/wishlist.tsx`
- `mobile/app/scanner-session.tsx`
- `mobile/app/scanner-recovery.tsx`
- `mobile/app/settings.tsx`
- `mobile/app/plans.tsx`
- `mobile/app/welcome.tsx`
- `mobile/app/onboarding.tsx`
- `mobile/app/admin/*`
- `mobile/app/dev/*`

Historical backup folders were not included as active product surfaces.

## Executive Findings

- Implemented: Deal Desk and Seller/Signals were the highest-risk routes in this audit and now use TD primitive composition with real session state or honest unavailable states instead of hardcoded fake business metrics.
- Critical: Customer-facing routes mix `TD*` primitives, legacy `brand` primitives, raw `Text`, raw `Pressable`, and local one-off controls. This makes the app feel like several products.
- High: Many screens use large stacked cards for every section, which increases visual density and makes primary actions compete with secondary metadata.
- High: Scanner is the most aligned customer-facing screen after recent simplification, but downstream session review still uses dense filter and metric cards.
- High: Collection, Storage, Binder, Wishlist, and Session Review expose useful functionality but need stronger hierarchy, less boxing, and clearer progressive disclosure.
- Medium: Navigation is functionally account-aware and safe-area aware, but icon treatment and screen headers need one shared OS contract.
- Medium: Loading, empty, and error states are present, but several messages are technical or implementation-oriented.
- Low: Admin and dev routes are functional and intentionally lower priority until customer-facing surfaces are coherent.

## Route Classification

| Route | Purpose | Primary User Goal | Current Hero | Primary Action | Classification |
| --- | --- | --- | --- | --- | --- |
| `/(tabs)` Home | Account-aware overview | Know what matters next | Portfolio/status card | Smart action row | Moderate migration |
| `/(tabs)/collection` | Inventory browser | Find and open owned cards | Title/search plus metrics | Search collection | Moderate migration |
| `/(tabs)/scan` | Scanner intake | Capture and confirm cards quickly | Camera viewport | Capture | Minor polish |
| `/(tabs)/deal-desk` | Buying/trade terminal | Price and start a deal | Offer calculator | Start session | Partially Implemented |
| `/(tabs)/sell` | Seller signals/activity | See seller work | Honest unavailable summary | Shortcut actions | Partially Implemented |
| `/(tabs)/profile` | Account/settings hub | Manage account/session | Identity row | Settings/membership rows | Moderate migration |
| `/auth` | Authentication | Sign in safely | Auth form panel | Sign in | Moderate migration |
| `/collection/[cardId]` | Card detail | Inspect and organize a card | Card image plus title | Contextual mutation controls | Moderate migration |
| `/storage-locations` | Storage manager | Answer where a card is | Storage title/create card | Create/assign location | Moderate migration |
| `/trade-binder` | Trade inventory | See available trades | Trade Binder title/metrics | Search/filter/update status | Moderate migration |
| `/wishlist` | Wanted cards | Manage desired cards and matches | Wishlist title/add card | Add wanted card | Moderate migration |
| `/scanner-session` | Scan session review | Review and finalize intake | Session title/metrics | Export or bulk confirm | Moderate migration |
| `/scanner-recovery` | Offline scan recovery | Retry failed queued scans | Recovery list | Retry/discard | Minor polish |
| `/settings` | App settings | Manage preferences | Settings list | Toggle/update settings | Minor polish |
| `/plans` | Membership plans | Compare tiers | Plan cards | Choose/upgrade | Moderate migration |
| `/welcome` | Entry screen | Start or sign in | Brand splash | Continue/sign in | Minor polish |
| `/onboarding` | First-run setup | Choose account path | Onboarding prompts | Continue | Minor polish |
| `/admin/*` | Command Center | Manage platform | Admin dashboard | Admin route actions | Deferred |
| `/dev/*` | Development utilities | Inspect systems | Debug surfaces | Debug actions | Already aligned for dev-only use |

## Issue Inventory

| Severity | Area | Finding | Evidence | Recommended Direction |
| --- | --- | --- | --- | --- |
| Implemented | Data trust | Seller route previously showed hardcoded sales, shipping, margin, and underpricing values. | `mobile/app/(tabs)/sell.tsx` | Replaced with real active-session data, shortcuts, and explicit unavailable states. |
| Implemented | Cohesion | Deal Desk and Seller previously used `brand` primitives/raw styles while most current screens used `TD*` primitives. | `deal-desk.tsx`, `sell.tsx`, `components/primitives.tsx` | Migrated the active routes to shared design-system primitives and token names. |
| High | Screen hierarchy | Collection, Storage, Wishlist, Binder, and Session Review use stacked cards/chips for most content. | Active route files | Use one hero, rows, dividers, and sheets before adding cards. |
| High | Density | Scanner Session Review has many filters and metrics before session lines. | `scanner-session.tsx` | Collapse advanced filters behind a sheet or segmented control. |
| High | Technical copy | Several states mention Supabase, local/user-scoped storage, scanner integration points, and implementation details. | Auth, Profile, Storage, Session Review | Use customer-facing copy; keep technical detail in docs/dev diagnostics. |
| High | Primary action clarity | Card Detail exposes quantity, condition, finish, storage, binder, wishlist controls with similar weight. | `collection/[cardId].tsx` | Make card image hero; group organization actions progressively. |
| Medium | Navigation | Bottom navigation has correct five-tab contract but still uses route-level options rather than a formal navigation primitive. | `(tabs)/_layout.tsx` | Preserve contract, document visual model, and test geometry. |
| Medium | Typography | Display text is used in compact panels and screens where title scale would be calmer. | Collection, Storage, Wishlist | Apply screen-title and section-title rules consistently. |
| Medium | Empty states | Empty states exist but sometimes feel generic or instructive rather than operational. | Collection, Storage, Wishlist | Use specific next-best action and honest data availability. |
| Medium | Safe area | Most screens use manual `paddingBottom: 120/128/140`; tab clearance is not always centrally derived. | Multiple routes | Centralize screen bottom clearance and nav spacing rules. |
| Medium | Icon consistency | Ionicons is primary, but legacy primitives and ad hoc icon containers vary size/radius. | Home, Deal Desk, Seller, Profile | Use one icon scale and icon button primitive. |
| Medium | Surface overuse | Many rows are full `TDCard`s where dividers or list rows would be quieter. | Storage, Binder, Wishlist, Profile | Introduce list-row and section contracts. |
| Low | Motion | Press feedback exists in some routes but not consistently. | Home, tabs, auth | Standardize restrained press/haptic contract. |
| Low | Admin polish | Admin screens are functional but not aligned with mobile OS principles. | `mobile/app/admin/*` | Defer until customer-facing routes stabilize. |

## Screen Notes

### Home

- Current hero: floating portfolio card.
- Strengths: account-aware composition, real data loading, no fake charting.
- Issues: multiple large blocks compete after the hero; action row can feel like a second navigation strip.
- Classification: moderate migration.

### Scanner

- Current hero: camera viewport.
- Strengths: most aligned with the target hierarchy; OCR/Scryfall/session logic is preserved behind a simple surface.
- Issues: physical-device QA still required for safe areas, large text, and camera framing; result tray needs screenshot review.
- Classification: minor polish.

### Collection

- Current hero: title/search/summary cluster.
- Strengths: server pagination contracts, exact printing fields, safe missing-price behavior.
- Issues: metrics and action buttons crowd the hero; sort chips can wrap heavily on 320 px.
- Classification: moderate migration.

### Card Detail

- Current hero: card image and identity.
- Strengths: image is prominent and mutation flow is typed.
- Issues: organization controls are equally weighted and dense; Scryfall ID is customer-facing technical metadata.
- Classification: moderate migration.

### Storage Locations

- Current hero: Storage title and create-location card.
- Strengths: hierarchy, recent/favorite, assignment, archive behavior exist.
- Issues: create form appears before browse/search; location list and detail are both heavy.
- Classification: moderate migration.

### Trade Binder And Wishlist

- Current hero: title/metrics/filter stack.
- Strengths: matching, strict/flexible rules, optimistic updates, offline behavior exist.
- Issues: Binder and Wishlist are separate route surfaces instead of one coherent exchange workspace; repeated metadata and chip rows.
- Classification: moderate migration.

### Session Review

- Current hero: session title plus metric grid.
- Strengths: filters, export, bulk confirm, user-scoped persistence.
- Issues: dense controls before content; CSV/export copy is implementation-oriented.
- Classification: moderate migration.

### Deal Desk

- Current hero: current offer calculator.
- Strengths: core session flow, offer math, active-session controls, and TD primitive shell exist.
- Issues: physical-device QA and deeper workflow copy review are still needed before release polish is complete.
- Classification: partially implemented.

### Seller Signals

- Current hero: account-aware signals/activity summary.
- Strengths: route exists, tab contract is wired, fake metrics were replaced by explicit unavailable states and real session shortcuts.
- Issues: real seller analytics, operations feeds, and signal data sources remain unavailable.
- Classification: partially implemented.

### Profile And Auth

- Strengths: authentication functionality, remembered email, session controls, membership/admin access exist.
- Issues: brand/marketing copy is still heavier than necessary; Profile mixes raw Text with TD primitives.
- Classification: moderate migration.

## Migration Order

1. Formalize the Trading Docks Design Bible and mobile component contracts.
2. Add missing shared primitives for navigation headers, list rows, icon buttons, sheets, segmented controls, status indicators, skeletons, result trays, scanner guides, and session strips.
3. Align mobile shell/bottom navigation with the new contracts.
4. Keep Scanner layout as the reference customer-facing pattern and screenshot QA it.
5. Migrate Home, Collection, Card Detail, Storage, Binder/Wishlist, Session Review, Deal Desk, Profile, and Auth in separate reviewable passes.
6. Defer Admin and dev surfaces until customer-facing routes are coherent.

## Current Readiness

- Already aligned: development-only scanner diagnostics separation; account-aware five-tab navigation contract; scanner simplification.
- Minor polish: Scanner, settings, scanner recovery, welcome/onboarding.
- Moderate migration: Home, Collection, Card Detail, Storage, Trade Binder, Wishlist, Session Review, Profile, Auth, Plans.
- Partially implemented after this branch: Deal Desk and Seller/Signals route.
- Deferred: Admin/Command Center mobile polish.

## Branch Implementation Notes

- Implemented: Added the mobile design OS documentation set and tested that each new document declares implementation status.
- Implemented: Added canonical primitive, spacing, icon, and surface contracts to `mobile/design/component-model.ts`.
- Implemented: Expanded `mobile/components/design-system.tsx` with additive primitives for icon buttons, list rows, sheets, segmented controls, result trays, skeletons, toasts, status indicators, navigation headers, scanner guides, and session strips.
- Implemented: Centralized bottom navigation visual geometry in `mobile/services/navigation-contract.ts` without changing account-aware routes.
- Implemented: Reworked Deal Desk and Seller/Signals away from fake authenticated metrics while preserving current session, navigation, and offer behavior.
- Partially Implemented: The remaining customer-facing routes still need staged physical-device visual QA and selective migration using `docs/MOBILE_VISUAL_MIGRATION_PLAN.md`.
