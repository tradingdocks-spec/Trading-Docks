# Trading Docks Mobile V1 Release Matrix

Status: Implemented

## Legend

- Automated: covered by TypeScript, source contract tests, unit tests, or export checks.
- Physical: requires device verification.
- Passed: validated in this branch.
- Blocked: cannot be passed without external configuration, device, or product-owner review.
- Removed: not exposed in Mobile V1.
- Headquarters-only: routed to Trading Docks web/HQ.

## Route Matrix

| Route / Workflow | Automated | Physical | Status | Notes |
| --- | --- | --- | --- | --- |
| Launch `/` | Yes | Yes | Passed automated | Auth-state redirect covered by app routing tests. |
| Welcome | Yes | Yes | Passed automated | Entry actions route to onboarding/auth. |
| Auth | Yes | Yes | Passed automated | Production Supabase env still required in EAS. |
| Onboarding | Yes | Yes | Passed automated | Paid access remains backend-authoritative. |
| Home | Yes | Yes | Passed automated | Uses real collection/session data only. |
| Collection list/grid | Yes | Yes | Passed automated | Physical layout and large collections still need device QA. |
| Card detail | Yes | Yes | Passed automated | Mutation behavior covered by collector tests. |
| Storage locations | Yes | Yes | Passed automated | Mobile V1 collection organization surface. |
| Trade Binder | Yes | Yes | Passed automated | No marketplace workflow exposed. |
| Wishlist | Yes | Yes | Passed automated | Matching remains local to owned binder/wishlist records. |
| Scan hub | Yes | Yes | Passed automated | Routes to automatic, single, and review only. |
| Automatic Scan | Yes | Yes | Physical required | Native camera/OCR path needs final device pass. |
| Single Scan | Yes | Yes | Physical required | Result sheet and add flow require physical pass. |
| Scanner Session / Review List | Yes | Yes | Physical required | Must verify final item appears in Collection after device scan. |
| Scanner Recovery | Yes | Yes | Passed automated | Offline/replay tests cover user isolation and recovery states. |
| Intelligence | Yes | Yes | Passed automated | Uses current loaded collection/session data only. |
| Deal Desk `/deal-desk` | Yes | Yes | Passed automated | Contextual secondary route only; not a bottom tab for any account. |
| Profile | Yes | Yes | Passed automated | Headquarters opens web Command Center. |
| Plans / RevenueCat | Yes | Yes | Physical required | StoreKit device flow and backend reconciliation required. |
| Settings | Yes | Yes | Passed automated | No local-only fake switches remain. |
| Account Delete | Yes | Yes | Passed automated | Legal/account deletion path present. |
| Not Found | Yes | Yes | Passed automated | Returns home. |
| Modal | Yes | No | Remove from Mobile V1 | Template route should not be surfaced. |
| Admin native routes | Yes | No | Headquarters-only | Authorized roles see web/HQ handoff instead of native admin UI. |
| Dev design showcase | Yes | No | Development only | Explicit flag required. |
| Dev camera QA | Yes | No | Development only | Explicit diagnostics flag required. |
| Dev scanner benchmark | Yes | No | Development only | Explicit benchmark flag required. |

## Device Matrix

| Scenario | 320 | 375 | 390 | 430 | Wi-Fi | Cellular | Offline/Reconnect | Cold Launch | Background/Resume | Logout/Login |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical |
| Collection | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical |
| Automatic Scan | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical |
| Single Scan | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical |
| Scanner Review | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical |
| Plans / RevenueCat | Physical | Physical | Physical | Physical | Physical | Physical | Blocked without StoreKit scenario | Physical | Physical | Physical |
| Profile / Settings | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical | Physical |

## Release Blockers

| Severity | Area | Status |
| --- | --- | --- |
| P0 | Data loss / security / billing / crash | None confirmed by automated audit. Physical scanner and StoreKit QA still required. |
| P1 | Native admin route exposure | Fixed with Headquarters handoff. |
| P1 | Settings local-only controls | Fixed with status-only settings rows. |
| P1 | Intelligence current-data value | Fixed with current collection/session signals. |
| P1 | Deal Desk appearing as sixth tab | Fixed by removing tab registration and centralizing five-tab tests. |
| P2 | Home dead notification button | Fixed by removal. |
| P2 | Generic modal route | Fix required. |
