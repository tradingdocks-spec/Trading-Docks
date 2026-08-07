# Mobile Store Assets

Status: Planned. This document lists required App Store and Play Store assets for the first Trading Docks mobile release package.

## Canonical App Metadata

| Field | Current value | Status |
| --- | --- | --- |
| App name | Trading Docks | Implemented in Expo metadata; final store listing approval required. |
| iOS bundle id | `com.tradingdocks.app` | Implemented; Apple Developer ownership must be confirmed. |
| Android package | `com.tradingdocks.app` | Implemented; Google Play package ownership must be confirmed. |
| Version | `0.5.0` | Partially Implemented; final RC version must be approved before upload. |
| Build number/version code | iOS `1`, Android `1` | Implemented for baseline; release sequencing must be managed through EAS/store consoles. |
| Canonical site | `https://www.tradingdocks.com` | Requires Production Configuration for published legal/support pages. |

## Required Store Assets

| Asset | Status | Notes |
| --- | --- | --- |
| App icon | Implemented in source | Needs device and store-console visual QA. |
| Splash screen | Implemented in source | Needs physical-device launch QA. |
| iPhone screenshots | Planned | Capture only after final TestFlight QA. |
| iPad screenshots | Planned | Required if iPad support remains enabled. |
| Android phone screenshots | Planned | Capture from production profile/internal test build. |
| Android feature graphic | Planned | Product-owner/design approval required. |
| Short description | Planned | Must not claim unverified scanner recognition accuracy. |
| Full description | Planned | Must describe current supported behavior, not future marketplace/billing features. |
| Keywords | Planned | Product-owner approval required. |
| Support URL/email | Requires Production Configuration | Current mobile default is `mailto:tradingdocks@gmail.com`; final store metadata approval required. |
| Privacy policy URL | Requires Production Configuration | Current default is `https://www.tradingdocks.com/privacy`; page content must be approved. |
| Terms URL | Requires Production Configuration | Current default is `https://www.tradingdocks.com/terms`; page content must be approved. |
| Review notes | Planned | Include demo account, billing strategy, scanner limitations, and account deletion path. |

## Copy Guardrails

- Do not claim OCR, camera recognition, auto-capture, pricing, marketplace, billing, or account deletion production readiness without supporting validation.
- Describe scanner behavior as confirmation-first until benchmarked physical-device evidence supports stronger wording.
- Describe paid mobile upgrades as Planned unless native StoreKit/Google Play Billing and backend entitlement reconciliation are approved and implemented.
- Mention account deletion as support-assisted until backend self-service deletion exists.

## Asset QA

- Verify all screenshots match the active mobile design and do not show development routes, diagnostics, benchmark tools, crop proofs, local fixture paths, secrets, fake data, or unsupported paid purchase success.
- Verify images do not display copyrighted card images without permission.
- Verify text remains readable at store thumbnail sizes and does not imply legal or financial advice.
