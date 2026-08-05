# Memberships

## Canonical Contract

- Implemented: `mobile/services/membership-catalog.ts` is the canonical typed membership and entitlement catalog for active web and mobile code.
- Implemented: `src/lib/membership-catalog.ts` re-exports the canonical catalog for Next.js.
- Implemented: `src/lib/plan-entitlements.ts`, `src/lib/stripe/plans.ts`, and `mobile/constants/plans.ts` are platform adapters over the canonical catalog.
- Implemented: Internal account and membership identifiers are `free`, `collector`, `seller`, and `store`.
- Implemented: Legacy persisted value `business` is normalized to `store` at runtime for compatibility only.
- Planned: A reviewed Supabase migration should replace persisted `business` plan values and check constraints with `store`.

## Canonical Plans

| Tier | Status | Monthly | Annual | Annual Savings | Card Limit | Deck Limit | Employee Accounts |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Free | Implemented | $0 | $0 | $0 | 500 | 5 | Not included |
| Collector | Implemented | $4.99 | $49.99 | $9.89 | Unlimited | Unlimited | Not included |
| Seller | Implemented | $14.99 | $149.99 | $29.89 | Unlimited | Unlimited | Not included |
| Store | Implemented | $49.99 | $499.99 | $99.89 | Unlimited | Unlimited | Pending configuration |

## Entitlements

- Free: card scanner and basic collection tools.
- Collector: everything in Free, unlimited cards and decks, collection value and price history, financial insights, storage locations, trade binder, wishlist, and market signals.
- Seller: everything in Collector, Deal Desk, buying profiles, buying sessions, trade calculator, card-show tools, sealed evaluator, CSV/email export, and full web workspace access.
- Store: everything in Seller, employee accounts, shared buying profiles, approval limits, shared sessions, customer-facing trade summaries, shared inventory access, and store operations tools.

## Separation Of Authority

- Account type: workspace mode, not billing authority.
- Membership tier: product entitlement bundle.
- Billing status: Stripe-derived payment state and freshness.
- Platform role: `user_roles` authority for owner/admin/support/analyst/user.
- Resolved entitlements: derived output from tier, billing status, suspension state, and explicit admin override.
- Admin override: changes product entitlements without changing platform role or Stripe subscription state; future audit requirements are documented but not fully enforced in schema yet.

## Provider Mapping

- Implemented: Stripe price mapping is separate from product definitions through `MEMBERSHIP_PROVIDER_MAPPINGS`.
- Requires Production Configuration: Existing Stripe price IDs must be checked against the canonical prices before live billing is enabled.
- Planned: RevenueCat mappings are represented as planned provider rows only; RevenueCat is not active.

## Safe Fallbacks

- Missing membership or unknown tier falls back to Free.
- Legacy `business` input normalizes to Store for compatibility, but active code should not persist it.
- Canceled, unpaid, paused, incomplete, expired, or stale past-due billing falls back to Free.
- Active and trialing billing grant paid entitlements.
- Past-due billing grants paid entitlements only while `current_period_end` remains in the future.
- Suspended accounts receive no product entitlements and no Command Center access.
- Platform role never implies paid product entitlements.
- Implemented: Web Collector organization mutations enforce the Free 500-card limit through the canonical membership catalog before quantity writes are accepted.
- Partially Implemented: Mobile Collector organization mutations validate the Free limit client-side for immediate UX and rely on Supabase RLS for ownership. A DB-side migration proposal is still required for production-authoritative native Free-limit enforcement.
- Implemented: The Collector mutation security proposal interprets the Free limit as 500 total owned card quantity across inventory rows, not 500 unique rows.
- Implemented: The proposal keeps platform role separate from paid entitlement; an admin role with Free membership remains subject to the Free card limit unless an explicit membership override grants a paid tier.

## Current Gaps

- Requires Production Configuration: `billing_subscriptions.plan_id`, `admin_membership_overrides.plan_id`, `account_trials.plan_id`, and legacy admin SQL still contain `business` check constraints in migrations.
- Partially Implemented: Route gates exist for dashboard UI, but endpoint-level entitlement enforcement still needs an API-by-API audit.
- Partially Implemented: Store employee-account capacity is intentionally pending; no numeric seat count is committed in the product contract.
