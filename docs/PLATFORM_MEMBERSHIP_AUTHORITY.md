# Platform Membership Authority

Status: Partially Implemented

Trading Docks keeps these concepts separate:

| Concept | Meaning | Canonical source | Status |
| --- | --- | --- | --- |
| Auth user | Signed-in Supabase identity | Supabase Auth | Implemented |
| Platform role | owner, admin, support, analyst, user | `user_roles` | Partially Implemented |
| Account type | Which workspace experience the user uses | Profile/preferences/workspace context | Partially Implemented |
| Membership tier | Paid product tier | Billing reconciliation plus catalog | Partially Implemented |
| Billing status | Provider subscription state | Stripe/RevenueCat server records | Partially Implemented |
| Entitlements | Features and limits granted after resolution | Membership catalog + explicit override | Partially Implemented |

## Canonical Membership Tiers

Source of truth: `mobile/services/membership-catalog.ts`.

Web imports the same contract through `src/lib/membership-catalog.ts`. That file must remain a platform adapter/re-export and must not define a second membership catalog.

| Tier | Status | Price | Limits | Notes |
| --- | --- | --- | --- | --- |
| Free | Implemented | $0 | 500 total cards, 5 decks | Basic collection tools and scanner entry. |
| Collector | Implemented | $4.99/month, $49.99/year | Unlimited cards and decks | Collection value, price history, financial insights, storage, trade binder, wishlist, market signals. |
| Seller | Implemented | $14.99/month, $149.99/year | Unlimited cards and decks | Includes Collector plus Deal Desk, buying profiles/sessions, exports, and full web workspace access. |
| Store | Implemented | $49.99/month, $499.99/year | Unlimited cards and decks, employee capacity pending configuration | Internal identifier is `store`. Do not persist `business` as a new tier. |

## Store Versus Business

Status: Partially Implemented

- `store` is the canonical internal account and membership identifier.
- `business` is a legacy alias and may appear only for backwards compatibility or broad marketing copy.
- `normalizeMembershipTier("business")` resolves to `store`.
- New code must not create a second `business` catalog, entitlement set, or route family.

## Provider Identifiers

Status: Partially Implemented

Provider identifiers are separate from product definitions.

| Provider | Status | Identifier examples | Notes |
| --- | --- | --- | --- |
| Stripe | Implemented | `price_*` ids | Existing web billing behavior remains active. |
| RevenueCat | Requires Production Configuration | `tradingdocks.collector.monthly`, `collector_monthly`, entitlement `Collector` | Mobile SDK must not grant membership directly; webhook reconciliation is authoritative. |

## Resolution Precedence

Status: Partially Implemented

Current server reconciliation behavior:

1. Explicit manual membership override wins when present.
2. Valid provider subscriptions are ranked by tier strength.
3. Active or still-current canceled/past-due provider state may remain valid until the period end.
4. Missing or stale billing data falls back safely to Free.

Admin role is additive and separate. A platform role alone does not imply paid membership entitlements.

## Required Guardrails

Status: Partially Implemented

- Mobile clients may display cached access but must not authorize privileged operations.
- Web routes and API routes must resolve access server-side.
- Stripe must not be downgraded by an expired Apple subscription.
- RevenueCat entitlement identifiers must remain `Collector`, `Seller`, and `Store`.
- RevenueCat package identifiers must remain:
  - `collector_monthly`
  - `collector_yearly`
  - `seller_monthly`
  - `seller_yearly`
  - `store_monthly`
  - `store_yearly`
