# Trading Docks Mobile Product Completion Audit

Status: Implemented

Branch: `codex/trading-docks-os-ultimate-polish`

Checkpoint base: `31338df`

## Mobile V1 Rule

If a user can see it in the release app, it must work. If it does not work on mobile V1, it must be repaired, removed from production mobile, or replaced with an intentional Headquarters handoff.

## Production Route Inventory

| Route | Classification | Release Decision | Notes |
| --- | --- | --- | --- |
| `/` | PRODUCTION READY | Keep | Launch route redirects by auth state. |
| `/welcome` | PRODUCTION READY | Keep | Entry actions route to onboarding or auth. |
| `/auth` | PRODUCTION READY | Keep | Email/password calls Supabase, preserves OAuth and magic-link entry points, and avoids local password storage. |
| `/onboarding` | FUNCTIONAL BUT NEEDS POLISH | Keep | Plan choice seeds account type and routes to auth. Paid activation remains backend-authoritative. |
| `/(tabs)` / Home | FUNCTIONAL BUT NEEDS POLISH | Keep | Uses real collection summary and recent cards. No fake metrics found. |
| `/(tabs)/collection` | FUNCTIONAL BUT NEEDS POLISH | Keep | Browse, search, sort, pagination, empty/error/stale states exist. Advanced edits live in card detail/storage/binder/wishlist flows. |
| `/collection/[cardId]` | FUNCTIONAL BUT NEEDS POLISH | Keep | Owned card detail supports quantity, condition, finish, storage, trade, wishlist actions. |
| `/storage-locations` | FUNCTIONAL BUT NEEDS POLISH | Keep | Mobile storage manager is useful for V1 collection organization; scan-to-location remains clearly marked as integration-only and must not be promoted. |
| `/trade-binder` | FUNCTIONAL BUT NEEDS POLISH | Keep | Useful V1 collection companion; no marketplace or peer trading workflow exposed. |
| `/wishlist` | FUNCTIONAL BUT NEEDS POLISH | Keep | Useful V1 collection companion; matching is local to owned binder and wishlist records. |
| `/(tabs)/scan` | PRODUCTION READY | Keep | One scan hub, no duplicated secondary rows after Stage B. |
| `/scan/automatic` | FUNCTIONAL BUT NEEDS PHYSICAL QA | Keep | Uses current native scanner, OCR, recognition, session insertion, and recovery architecture. Physical device QA remains required. |
| `/scan/single` | FUNCTIONAL BUT NEEDS PHYSICAL QA | Keep | Manual capture, result, finish correction, other printings, add, and retake exist. Physical device QA remains required. |
| `/scanner-session` | FUNCTIONAL BUT NEEDS PHYSICAL QA | Keep | Review list and finalize/save flows exist. Must be verified on device after scanner capture. |
| `/scanner-recovery` | PRODUCTION READY | Keep | Recovery for queued scanner writes; user-scoped and action-required states exist. |
| `/(tabs)/sell` | PRODUCTION READY | Keep as Intelligence | Uses current loaded collection/session data for valuable cards, duplicates, missing prices, storage gaps, trade markers, wishlist overlap, foils, and recent additions. |
| `/(tabs)/deal-desk` | FUNCTIONAL BUT NEEDS POLISH | Keep for Seller/Store tabs only | Buying/session calculator works from saved session state. It is not exposed to Free/Collector primary tabs. |
| `/(tabs)/profile` | PRODUCTION READY | Keep | Identity, membership, settings, legal links, delete account, sign out, and Headquarters handoff exist. |
| `/plans` | FUNCTIONAL BUT NEEDS DEVICE QA | Keep | RevenueCat purchase/restore flow is backend-authoritative and must be verified on iOS device. |
| `/settings` | PRODUCTION READY | Keep | Shows production-backed status rows and routes unsupported configuration to iOS Settings or Headquarters instead of local fake toggles. |
| `/account-delete` | PRODUCTION READY | Keep | User-facing deletion request route exists. |
| `/modal` | REMOVE FROM MOBILE V1 | Remove/handoff | Generic template route should not be visible in a release app. |
| `/experience` | REMOVE FROM MOBILE V1 | Remove/handoff | Redirect-only legacy route; keep harmless redirect but do not surface. |
| `/+not-found` | PRODUCTION READY | Keep | Returns users home. |
| `/admin/*` | WEB/HQ ONLY | Headquarters handoff | Native Command Center routes are not Mobile V1 scope. Authorized platform roles see an intentional protected web Headquarters handoff. |
| `/dev/design-system` | DEVELOPMENT ONLY | Keep gated | Must remain unavailable unless explicit dev flag is enabled. |
| `/dev/camera-qa` | DEVELOPMENT ONLY | Keep gated | Must remain unavailable unless scanner diagnostics flag is enabled. |
| `/dev/scanner-benchmark` | DEVELOPMENT ONLY | Keep gated | Must remain unavailable unless benchmark builder flag is enabled. |

## Visible Action Audit

| Surface | Action | Status | Decision |
| --- | --- | --- | --- |
| Welcome | Get Started | PRODUCTION READY | Routes to onboarding. |
| Welcome | Sign In | PRODUCTION READY | Routes to auth. |
| Auth | Sign in / Enter key | PRODUCTION READY | Calls Supabase and shows exact sign-in errors through existing auth flow. |
| Auth | OAuth / magic link entries | PRODUCTION READY | Entry points preserved. Provider production redirects still require device QA. |
| Home | Scan | PRODUCTION READY | Routes to Scan hub. |
| Home | Collection | PRODUCTION READY | Routes to Collection. |
| Home | Add Card | PARTIAL | Routes to Collection; no standalone manual-add flow. Keep as collection handoff or rename if physical QA finds confusion. |
| Home | Review / Deal Desk | PRODUCTION READY | Routes by account type to review list or Deal Desk. |
| Home | Notifications icon | REMOVE FROM MOBILE V1 | Removed from the production Home header until mobile notifications are connected. |
| Collection | Storage | PRODUCTION READY | Routes to storage manager. |
| Collection | Trade | PRODUCTION READY | Routes to Trade Binder. |
| Collection | Wishlist | PRODUCTION READY | Routes to Wishlist. |
| Collection | Card row | PRODUCTION READY | Routes to owned card detail. |
| Scan hub | Start scanning | FUNCTIONAL BUT NEEDS DEVICE QA | Routes to Automatic Scan. |
| Scan hub | Single Scan | FUNCTIONAL BUT NEEDS DEVICE QA | Routes to Single Scan. |
| Scan hub | Review List | FUNCTIONAL BUT NEEDS DEVICE QA | Routes to scanner session. |
| Automatic Scan | Camera, torch, capture fallback, manual search, review session | FUNCTIONAL BUT NEEDS DEVICE QA | Keep; dev-only diagnostics must remain hidden. |
| Single Scan | Add card, Other printings, Retake | FUNCTIONAL BUT NEEDS DEVICE QA | Keep. |
| Intelligence | Deal Desk / Scan / Collection | PRODUCTION READY | Keep after replacing future-metric copy with real current-data signals. |
| Profile | Membership | PRODUCTION READY | Routes to Plans. |
| Profile | Open Headquarters | WEB/HQ ONLY | Opens protected web Command Center for platform roles. |
| Profile | Settings / scanner settings | PARTIAL | Settings route needs cleanup so controls are honest. |
| Profile | Support / Privacy / Terms | PRODUCTION READY | Opens configured legal/support links. |
| Profile | Delete Account | PRODUCTION READY | Routes to account deletion. |
| Profile | Sign out | PRODUCTION READY | Calls Supabase sign out. |
| Settings | Biometric / sync / haptics / notifications rows | PRODUCTION READY | Status-only rows describe current production behavior without unsupported local persistence claims. |
| Plans | Purchase / Restore | FUNCTIONAL BUT NEEDS DEVICE QA | Backend remains canonical; pending reconciliation copy exists. |

## P0 / P1 Findings

| Severity | Finding | Decision |
| --- | --- | --- |
| P1 | Native `/admin/*` routes exposed a mobile admin product that is outside Mobile V1 and partially connected. | Fixed: active mobile admin path is now a Headquarters handoff. |
| P1 | Settings exposed local-only switches that implied working persisted preferences. | Fixed: settings are now status/action rows only. |
| P1 | Intelligence tab advertised future market/seller metrics rather than immediate current-data insight. | Fixed: Intelligence now derives from current loaded collection/session data. |
| P2 | Home notification icon had no destination. | Fixed: removed from production Home header. |
| P2 | `/modal` generic template route exists. | Convert to home redirect or intentional unavailable state; do not surface. |

## Mobile V1 Scope

Production mobile focuses on:

- Home
- Collection
- Scan
- Intelligence
- Account

The following remain Headquarters-only for Mobile V1:

- Large business administration
- Employee management
- Payroll
- Vendors
- Supply ordering
- Desktop analytics configuration
- Marketplace setup and complex channel operations
- Native platform Command Center

## Data Authority

- Supabase authenticated user id is the identity authority.
- Backend membership state remains canonical for access. RevenueCat/StoreKit results do not locally grant paid access.
- Local scanner/session/offline state may improve UX but is not canonical for membership or inventory authority.
- Collection, storage, trade binder, and wishlist writes must remain user-scoped.

## Remaining Device QA

Physical QA is still required for:

- RevenueCat monthly/yearly purchase, restore, upgrade, downgrade/switch, cancellation, pending, failure, backend reconciliation.
- Automatic Scan camera, focus, torch, OCR, exact printing, price enrichment, insertion, and remove-card reset.
- Single Scan capture, result, other printings, finish correction, Add Card, and Retake.
- Offline/reconnect scanner recovery.
- 320/375/390/430 width layout checks.
