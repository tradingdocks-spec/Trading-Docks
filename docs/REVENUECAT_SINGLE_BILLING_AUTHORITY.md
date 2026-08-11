# RevenueCat Single Billing Authority Migration

Status: Partially Implemented

Trading Docks is migrating commercial subscription authority from dual Stripe plus RevenueCat handling to RevenueCat as the single commercial source of truth. Platform Owner/Admin authority remains separate and may supersede commercial restrictions without changing the user's paid membership.

## Target Authority

Implemented:
- Mobile RevenueCat uses the authenticated Supabase UUID as the RevenueCat app user id.
- RevenueCat webhook events are authenticated server-side and written to `billing_provider_subscriptions`.
- The webhook reconciles a canonical `billing_subscriptions` cache row for fast web/mobile access checks.
- Shared platform access distinguishes commercial membership from trusted platform roles.

Partially Implemented:
- Server and mobile account access now read `billing_provider_subscriptions` to classify provider state as `revenuecat`, `stripe`, `mixed`, `manual`, `none`, or `unknown`.
- `resolveCommercialEntitlement` normalizes RevenueCat entitlements to `free`, `collector`, `seller`, or `store`.

Planned:
- Replace direct web Stripe Checkout and Stripe Billing Portal flows with a RevenueCat Web checkout/management flow.
- Stop using Stripe subscription webhooks to mutate effective membership after legacy subscribers are migrated or confirmed absent.

## RevenueCat Mapping

Existing configured identifiers:

| Membership | RevenueCat entitlement | Packages | Product ids |
| --- | --- | --- | --- |
| Collector | `Collector` | `collector_monthly`, `collector_yearly` | `tradingdocks.collector.monthly`, `tradingdocks.collector.yearly` |
| Seller | `Seller` | `seller_monthly`, `seller_yearly` | `tradingdocks.seller.monthly`, `tradingdocks.seller.yearly` |
| Store | `Store` | `store_monthly`, `store_yearly` | `tradingdocks.store.monthly`, `tradingdocks.store.yearly` |

Free has no paid RevenueCat entitlement.

## Stripe Inventory

Subscription billing:
- `src/app/api/billing/checkout/route.ts`: creates Stripe subscription Checkout Sessions.
- `src/app/api/billing/portal/route.ts`: creates Stripe Billing Portal sessions.
- `src/app/api/billing/webhook/route.ts`: handles Stripe subscription lifecycle and writes `billing_subscriptions`.
- `src/lib/stripe/server.ts`: initializes the Stripe server client from `STRIPE_SECRET_KEY`.
- `src/lib/stripe/plans.ts`: maps canonical plans to Stripe price ids.
- `src/components/billing/CheckoutButton.tsx`: starts direct Stripe checkout.
- `src/components/billing/PortalButton.tsx`: opens direct Stripe billing management.
- `src/app/dashboard/plans/TieredPlanComparison.tsx`: uses `CheckoutButton` for paid web upgrades.
- `src/app/actions/auth.ts`: preserves signup plan/billing query parameters using Stripe plan validation helpers.
- `src/app/dashboard/billing/success/page.tsx`: Stripe-specific success copy.

Historical schema still required during migration:
- `supabase/migrations/202607270006_stripe_billing.sql`
- `supabase/migrations/202608070001_revenuecat_subscription_reconciliation.sql`
- `billing_subscriptions.stripe_customer_id`, `stripe_subscription_id`, and `stripe_price_id`

Marketplace or non-membership payment references:
- `src/lib/email/tcgplayer.ts` and order/report UI copy reference invoices/marketplace commerce, not Trading Docks membership billing.
- Dashboard admin Billing & Credits copy is operational/admin surface copy, not necessarily Stripe subscription logic.

Legacy/dead or documentation-only:
- Several docs still describe Stripe as the web subscription provider. These must be updated during the Stripe retirement phase.

Still required until subscriber migration is complete:
- Direct Stripe webhook handling must remain if any active legacy Stripe subscribers exist.
- Historical Stripe columns should not be dropped in this phase.

## Active Stripe Subscriber Gate

Before disabling or deleting Stripe membership handling, run this read-only production query:

```sql
select
  count(*) filter (
    where stripe_subscription_id is not null
      and status in ('active', 'trialing', 'past_due', 'unpaid', 'paused')
  ) as active_legacy_stripe_subscriptions,
  plan_id,
  status,
  count(*) as rows
from public.billing_subscriptions
where stripe_subscription_id is not null
group by plan_id, status
order by plan_id, status;
```

If `active_legacy_stripe_subscriptions` is greater than zero, do not remove Stripe subscription reconciliation until those subscribers are migrated to RevenueCat, manually comped through an explicit override, or allowed to age out under an approved product-owner plan.

## Staged Removal Plan

1. Audit provider state and subscriber counts.
2. Configure RevenueCat Web purchase/management for Collector, Seller, and Store using the existing identifiers above.
3. Route web upgrade CTAs to RevenueCat-managed checkout.
4. Keep the RevenueCat webhook as the only source that grants commercial paid access for new purchases.
5. Confirm mobile purchases unlock web and web purchases unlock mobile for the same Supabase UUID.
6. Confirm no active legacy Stripe membership subscribers remain, or migrate them explicitly.
7. Disable direct Stripe checkout and portal routes for membership subscriptions.
8. Keep historical Stripe fields for audit/read-only compatibility.
9. Propose a later schema cleanup only after production RevenueCat operation is verified.

## Safety Rules

- Client RevenueCat customer info may inform UX but must not authorize protected server mutations.
- `user_roles.owner` and `user_roles.admin` remain trusted platform authority and are not fake paid subscriptions.
- Ordinary users must not gain capabilities from editable profile state, localStorage, request params, or client-provided entitlements.
- Stripe metadata must not grant access once RevenueCat becomes the single commercial authority.
