# Mobile Privacy Release Audit

Status: Partially Implemented. This document records the current privacy posture and open release requirements for Trading Docks Mobile.

## Summary

- Implemented: Mobile Supabase client uses `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
- Implemented: Service-role keys are not used in active mobile client code.
- Implemented: Scanner capture permissions explain that photos are processed for scanning and are not retained by default.
- Implemented: Scanner diagnostics and benchmark builder are development-gated.
- Partially Implemented: Offline queues and scanner replay are user-scoped in code, but physical sign-out/switch-account QA remains required.
- Requires Production Configuration: Privacy policy URL, terms URL, App Privacy responses, Play Data Safety, analytics/crash reporting disclosures, and support contact flow.

## Data Categories

| Area | Current behavior | Release status |
| --- | --- | --- |
| Authentication | Supabase auth stores session through platform-safe storage. Passwords are not stored locally. | Implemented; OAuth/magic-link device QA required. |
| Camera images | Scanner captures are temporary scan inputs. No source card images are retained by default. Diagnostics may defer cleanup only when development flags are enabled. | HIGH |
| OCR data | Apple Vision OCR runs in the native build. Text signals may be used for card lookup. | HIGH |
| Scryfall lookup | Card-name/set/collector metadata may be sent to Scryfall for lookup; source images are not uploaded in this sprint. | Implemented |
| Local cache | App storage is used for preferences, scanner replay, offline state, and benchmark metadata. | HIGH until user-switch QA passes |
| Offline queue | Queue entries include user id and operation/idempotency fields; failed entries remain recoverable. | HIGH |
| Scanner diagnostics | Shows device IDs, camera format, crop proof, latency, and signal details only behind development flags. | BLOCKER if exposed in production |
| Benchmark images | Private benchmark images are local-only and ignored by Git. | Implemented as tooling rule |
| Logs | Diagnostic logs are intended to exclude passwords, tokens, secrets, and source images. | MEDIUM; production logging provider not finalized |
| Admin data | Admin surfaces expose account/subscription/system data to privileged roles only. | HIGH; production RBAC/RLS verification required |

## Store Disclosure Matrix

| Data category | Collected | Linked to user | Tracking | Purpose | Retention/source |
| --- | --- | --- | --- | --- | --- |
| Account identifiers | Yes | Yes | No tracking implemented | Authentication, support, account recovery. | Supabase auth/profile records. |
| Email address | Yes | Yes | No tracking implemented | Sign-in, support, deletion requests. | Supabase auth and support email flow. |
| Collection data | Yes | Yes | No tracking implemented | User collection, storage, Trade Binder, Wishlist, scanner review. | Supabase user-owned rows and user-scoped local cache. |
| Camera images | Temporary only | No persistent default | No | Card scan processing. | In-memory or temporary file; deleted by default after processing. |
| OCR text/card metadata | Yes when scanning | Yes when saved to collection/session | No tracking implemented | Exact-printing lookup and user confirmation. | Local OCR output, Scryfall metadata lookup, scanner session rows. |
| Payment/subscription state | Yes when configured | Yes | No tracking implemented | Membership entitlement display and backend authorization. | Backend subscription records; mobile native billing is Planned. |
| Diagnostics/benchmark data | Development only | Potentially device-associated in local dev | No | Scanner QA and calibration. | Local-only development tooling behind flags; not for production builds. |
| Crash/analytics data | Not finalized | Not finalized | Not finalized | Planned observability. | Requires provider decision before disclosure can be final. |

## Security Checks

- No secret environment values should be logged or bundled into mobile builds.
- Mobile must not include `SUPABASE_SERVICE_ROLE_KEY`, service-role tokens, or `sb_secret` keys.
- RLS/server checks remain authoritative for inventory ownership, account data, and admin operations.
- Sign-out must stop replay for the current user and must not expose that user's queued scans to another account.
- Scanner captures must be deleted after processing unless diagnostics explicitly defer cleanup in development.

## Release Blockers

- BLOCKER: Confirm production builds do not expose `/dev/camera-qa`, `/dev/scanner-benchmark`, scanner diagnostics sheets, or crop proofs.
- BLOCKER: Complete physical-device QA for camera denied/unavailable, app backgrounding, offline replay, logout/login, and user switching.
- BLOCKER: Confirm privacy policy, terms, support URL, and account deletion policy with product owner/legal.
- HIGH: Decide analytics/crash reporting provider and event schema before collecting production telemetry.

## Store Disclosure Notes

- Camera access is used to scan trading cards.
- Captured card images are processed for recognition/confirmation and are not retained by default.
- Card metadata may be sent to third-party card-data services for lookup and enrichment.
- Account, collection, wishlist, trade binder, storage, and sync data are tied to the authenticated user.
- Paid subscription data will be reconciled through the canonical backend when mobile billing is approved.
