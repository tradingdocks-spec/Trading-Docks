# Memberships

## Web Membership Model

- Implemented: Web account tiers are `free`, `collector`, `seller`, and `business`.
- Implemented: `PLAN_ENTITLEMENTS` defines names, monthly prices, annual prices, inventory limits, and deck limits.
- Implemented: `tier-access.ts` maps dashboard features and routes to minimum plans.
- Implemented: `PlanAccessGate` blocks dashboard screens when the current plan lacks access.
- Implemented: `getEffectivePlan` reads billing subscriptions, admin membership overrides, user preferences, and owner preview cookies.
- Requires Production Configuration: Stripe price IDs, customer portal, checkout, webhooks, and live/test isolation.

## Current Web Plan Values

| Tier | Status | Monthly | Annual | Inventory Limit | Deck Limit |
| --- | --- | ---: | ---: | ---: | ---: |
| Free | Implemented | $0 | $0 | 500 | 10 |
| Collector | Implemented | $4.99 | $44.99 | 10,000 | 50 |
| Seller | Implemented | $19.99 | $179.99 | 50,000 | Unlimited |
| Store/Business | Implemented | $49.99 | $449.99 | 250,000 | Unlimited |

## Mobile Membership Model

- Partially Implemented: Mobile account types are `free`, `collector`, `seller`, and `store`.
- Partially Implemented: Mobile stores selected account type locally via `AccountProvider`.
- Partially Implemented: Mobile pricing constants do not match web pricing exactly.
- Requires Production Configuration: Mobile subscriptions are not connected to RevenueCat or Stripe as the authoritative source.

## Known Membership Risks

- Partially Implemented: `business` on web and `store` on mobile represent the same commercial tier but use different enum values.
- Partially Implemented: Mobile `collector` claims unlimited collection and decks, while web limits collector to 10,000 inventory and 50 decks.
- Partially Implemented: Some routes are gated in the client shell, but endpoint-level entitlement enforcement needs a separate audit.
- Planned: Membership data should become a shared contract used by web, mobile, billing, and marketing.
