# Mobile Release Blockers

Status: Partially Implemented. This blocker table records the remaining items before Trading Docks Mobile can be called TestFlight/store-ready.

| ID | Area | Severity | Device | Status | Owner | Evidence | Fix commit | Retest |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MRC-001 | Physical-device QA | BLOCKER | iOS and Android | Planned | Product owner + QA | Repository checks cannot prove iOS/Android camera, OCR, VoiceOver, TalkBack, large text, app switching, or offline replay behavior. | Pending | Complete and document device QA on final EAS builds. |
| MRC-002 | Native identifiers | HIGH | iOS and Android | Implemented in source | Engineering | `mobile/app.json` uses `com.tradingdocks.app` for iOS and Android. | This branch | Confirm Apple Developer and Google Play ownership; create clean EAS builds. |
| MRC-003 | Production environment | BLOCKER | All | Partially Implemented | Engineering | `docs/MOBILE_PRODUCTION_ENV.md` and `npm run verify:production-release` define checks. | This branch | Run validator with production public env values and no development flags. |
| MRC-004 | Development routes | BLOCKER | All | Implemented in source | Engineering + QA | `/dev/design-system`, `/dev/camera-qa`, and `/dev/scanner-benchmark` redirect when flags are disabled or `NODE_ENV=production`. | This branch | Verify in production build and store screenshots. |
| MRC-005 | Account deletion | BLOCKER | iOS and Android | Partially Implemented | Product owner + legal | Mobile exposes a support-assisted deletion request path; backend self-service deletion is Planned. | This branch | Approve support-assisted compliance or implement approved backend deletion. |
| MRC-006 | Legal/support links | BLOCKER | iOS and Android | Partially Implemented | Product owner + legal | Mobile defaults to `mailto:tradingdocks@gmail.com`, `https://www.tradingdocks.com/privacy`, and `https://www.tradingdocks.com/terms`. | This branch | Confirm final URLs/email and published legal content before submission. |
| MRC-007 | Billing | BLOCKER for paid upgrades | iOS and Android | Planned | Product owner + engineering | Free-only mobile RC strategy is documented; native purchase processing is not implemented. | This branch | Keep paid mobile upgrades disabled/informational or implement approved StoreKit/Google Play Billing with backend reconciliation. |
| MRC-008 | Entitlement authority | HIGH | All | Partially Implemented | Engineering | Shared model separates account type, platform role, membership tier, billing status, and entitlements. | Prior foundation + this branch docs | Verify backend subscription and RLS behavior in staging; do not grant paid access from mobile-only state. |
| MRC-009 | Scanner/OCR claims | BLOCKER | iOS and Android | Partially Implemented | Product owner + QA | Native OCR and scanner flows exist, but physical-device benchmark evidence remains incomplete. | Pending | Keep confirmation-first wording and complete measured QA before stronger store copy. |
| MRC-010 | Privacy disclosures | BLOCKER | iOS and Android | Partially Implemented | Product owner + legal | Disclosure matrix exists; analytics/crash provider remains undecided. | This branch | Complete App Privacy and Play Data Safety from approved policy. |
| MRC-011 | Store assets | BLOCKER | iOS and Android | Planned | Product owner + design | Asset inventory exists in `docs/MOBILE_STORE_ASSETS.md`. | This branch | Produce approved screenshots, descriptions, keywords, review notes, demo-account flow, and support/legal metadata. |
| MRC-012 | Release validation | BLOCKER | All | Partially Implemented | Engineering | Automated checks pass in this workspace; physical native QA remains manual. | This branch | All validation commands pass and unresolved native-only behavior is explicitly accepted or fixed. |

## Release Decision

Trading Docks Mobile is not yet certified as a production Release Candidate. The safest current strategy is a Free-only mobile RC with paid entitlement display only, support-assisted account deletion, production-safe legal links, gated development tooling, and no claims of unverified scanner recognition accuracy.
