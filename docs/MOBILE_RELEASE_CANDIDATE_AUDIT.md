# Mobile Release Candidate Audit

Status: Partially Implemented. This audit records the current mobile app state on `codex/trading-docks-os-ultimate-polish`; it does not certify Release Candidate readiness.

Physical-device QA remains required before any TestFlight or store release claim.

## Severity Key

- BLOCKER: Must be resolved before external release.
- HIGH: Significant release risk that can ship only with explicit product-owner acceptance.
- MEDIUM: Important quality debt that should be scheduled soon.
- POLISH: Fit-and-finish issue that does not block validation.

## Current Release Blockers

- BLOCKER: Physical-device QA is not complete for iOS, Android, camera permission denial, native VisionCamera, Apple Vision OCR, VoiceOver, TalkBack, large text, offline replay, and account switching.
- BLOCKER: Mobile paid membership purchase is not active or approved. Digital subscriptions must use an Apple/Google-compliant purchase architecture before paid mobile upgrade UI can process payments.
- BLOCKER: Production environment gates must be verified for `/dev/*`, scanner diagnostics, benchmark builder, and design-system showcase before release builds.
- BLOCKER: Account deletion now has a support-assisted mobile request path, but backend self-service deletion is Planned and App Store deletion policy copy still needs product-owner/legal confirmation.
- BLOCKER: Support, privacy, and terms links now have production-safe defaults; product-owner/legal must confirm final store metadata URLs before submission.
- BLOCKER: App Privacy, Data Safety, subscription metadata, screenshots, review notes, and physical-device evidence remain incomplete.

## Route Audit

| Route | Purpose | Primary action | States | Dependencies | Release status |
| --- | --- | --- | --- | --- | --- |
| `/` | Launch gate after auth/session restoration. | Redirect to tabs or welcome. | Implemented branded loading; no empty/error/offline UI. | Auth restoration. | POLISH |
| `/_layout` | Root providers, biometric lock, scanner replay bridge, stack shell. | Restore app session. | Implemented branded loading and production-safe route error boundary. | Auth, account, admin, scanner replay. | HIGH |
| `/welcome` | Unauthenticated product entry. | Get Started or Sign In. | Implemented compact launch copy; no offline dependency. | None. | POLISH |
| `/auth` | Sign in, sign up, magic link, OAuth, biometric preference. | Submit credentials or provider flow. | Implemented loading/error states and sanitized customer copy; native OAuth/magic-link QA remains required. | Supabase auth, local auth preferences. | HIGH |
| `/onboarding` | Select account intent. | Continue to auth. | Implemented one decision; does not force purchase. | Local account preference. | POLISH |
| `/plans` | View membership catalog. | Start Free or create account for paid interest. | Implemented with no mobile purchase processing; billing architecture remains unapproved. | Membership catalog, account preference. | BLOCKER for paid release |
| `/(tabs)/_layout` | Account-aware bottom tabs. | Navigate primary workspace. | Implemented account tabs and loading fallback; physical safe-area QA remains required. | Auth, account type, admin additive access. | HIGH |
| `/(tabs)/index` | Home Product V2. | Scan, search, review recent collection. | Implemented skeleton/stale/offline patterns from data service; physical render/performance QA remains. | Auth, collection data, sync state. | HIGH |
| `/(tabs)/collection` | Browse owned collection. | Search/filter/open card. | Implemented loading/empty/error/offline patterns; cursor pagination scalability work remains documented debt. | Auth, inventory, entitlements. | HIGH |
| `/collection/[cardId]` | Owned card detail and organization actions. | Edit organization fields. | Implemented loading/error/mutation feedback; server proposal for direct native limit enforcement is not applied. | Auth, inventory ownership, membership. | HIGH |
| `/storage-locations` | Manage locations and assignments. | Create/select location. | Implemented current location manager; hierarchy migration remains proposal-only where schema gaps exist. | Auth, inventory locations, offline queue. | HIGH |
| `/trade-binder` | Manage tradeable cards. | Search/filter/update trade status. | Implemented empty/loading/error/offline patterns; no peer marketplace. | Auth, binder table, storage display. | MEDIUM |
| `/wishlist` | Manage wanted cards and matching. | Add/remove/update wishlist priority. | Implemented empty/loading/error/offline patterns; matching remains strict and local to user's data. | Auth, wishlist table, collection data. | MEDIUM |
| `/(tabs)/scan` | Scanner mode selection. | Start automatic or single scan. | Implemented polished scanner entry; native camera QA remains. | Auth, camera permission at point of need. | HIGH |
| `/scan/automatic` | Scanner V3 automatic intake. | Auto-capture and add to review list. | Implemented native camera states, permission states, failure recovery, diagnostics gating; device QA is still required. | VisionCamera, Apple OCR module, Scryfall lookup, scanner queue. | BLOCKER until physical QA |
| `/scan/single` | Single-card guided scan. | Capture one card and confirm. | Implemented manual recovery and exact-printing flow; native QA required. | VisionCamera, OCR, collection mutations. | BLOCKER until physical QA |
| `/scanner-session` | Review scanner batch. | Mark reviewed and finalize. | Implemented loading/error/missing-price states; pricing must remain real or unavailable. | Scanner session store, pricing enrichment, collection mutations. | HIGH |
| `/scanner-recovery` | Recover failed queued scanner adds. | Retry or discard queued scans. | Implemented pending/failed/action-required states; needs user-switch and reconnect device QA. | Scanner replay queue, auth user id. | HIGH |
| `/deal-desk` | Contextual Store/Seller offer workspace. | Start/manage buying session outside primary tabs. | Implemented render fix and empty/populated states; scanner/session math regression QA remains. | Account type, session storage, pricing availability. | HIGH |
| `/(tabs)/sell` | Seller signals/operations surface. | Review selling signals. | Implemented honest unavailable states for unsupported metrics. | Account type, seller entitlements. | MEDIUM |
| `/(tabs)/profile` | Profile, membership, security, admin entry. | Manage account/sign out. | Implemented sections, sign-out, support/legal links, account deletion request, and app version/build display; legal approval remains required. | Auth, account, admin role. | HIGH |
| `/settings` | Preferences and diagnostics gates. | Update preferences/security. | Implemented settings groups, support/legal links, account deletion request, About version/build, and production-gated diagnostics. | Auth preference storage. | MEDIUM |
| `/admin/*` | Protected Command Center. | Manage platform operations. | Implemented protected admin routes; customer release should keep access additive and server-authorized. | Admin role from user_roles, Supabase RPCs. | HIGH |
| `/dev/design-system` | Design-system showcase. | Inspect primitives. | Gated by `EXPO_PUBLIC_ENABLE_DESIGN_SYSTEM_SHOWCASE`; verify production exclusion. | Development env flag. | BLOCKER if exposed |
| `/dev/camera-qa` | Native camera diagnostics. | Inspect camera device/format. | Gated by scanner diagnostics flag; includes internal device data. | Development env flag, VisionCamera. | BLOCKER if exposed |
| `/dev/scanner-benchmark` | Private benchmark builder. | Create local fixtures. | Gated by benchmark flag; private images must remain local and ignored. | Development env flag, camera, local storage. | BLOCKER if exposed |
| `/experience` | Legacy demo route. | Redirect to tabs. | Implemented redirect; fake demo copy removed. | None. | POLISH |
| `/modal` | Generic fallback modal. | Return Home. | Implemented branded fallback; no template copy remains. | None. | POLISH |

## Cross-Cutting Findings

- Visual hierarchy: Implemented for main tabs and scanner surfaces; admin surfaces are functional but denser and should stay internal.
- Loading: Implemented branded startup, route-level error boundary, and many route-specific states.
- Empty/error/offline: Implemented unevenly. Collection/scanner/recovery are strongest; profile/settings/admin should continue converging on shared state components.
- Navigation: Account-aware tabs are implemented. Admin remains additive. Deep-link and browser/Expo Web refresh behavior still require manual QA.
- Motion/haptics: Motion standard exists and is partially adopted. Reduce Motion physical QA remains required.
- Accessibility: Design-system labels and selected states exist; VoiceOver/TalkBack and large text testing remain release blockers.
- Debug copy: Provider/debug copy was removed from primary launch/auth/plans paths. Admin and dev routes intentionally contain internal language behind role or env gates.
- Unsupported controls: Paid mobile upgrade controls are informational only and must not imply completed purchases.
