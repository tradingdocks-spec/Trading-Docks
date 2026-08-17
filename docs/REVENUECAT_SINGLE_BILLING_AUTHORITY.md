# RevenueCat Single Billing Authority Migration

Status: Implemented in code; Requires Production Configuration

Trading Docks now treats RevenueCat as the single commercial subscription authority. Trusted platform Owner/Admin authority remains separate and may grant full platform access without changing a user's commercial membership or billing plan.

## Current Authority

Implemented:
- Mobile RevenueCat uses the authenticated Supabase UUID as the RevenueCat app user id.
- RevenueCat webhook events are authenticated server-side and written to `billing_provider_subscriptions`.
- The webhook reconciles a canonical `billing_subscriptions` cache row for fast web/mobile access checks.
- Web paid upgrade CTAs now request RevenueCat Web Purchase Links through `/api/billing/revenuecat`.
- Web subscription management now requests a RevenueCat customer management link through `/api/billing/revenuecat/portal`.
- Web billing helpers validate missing or malformed RevenueCat purchase/management URLs and return clear unavailable states instead of silently failing.
- Direct Stripe membership checkout, portal, webhook, server helper, and plan mapping source files have been retired.
- Historical Stripe metadata is ignored by effective commercial-membership resolution.
- Shared platform access distinguishes commercial membership from trusted platform roles.

Requires Production Configuration:
- Configure RevenueCat Web Purchase Links for the paid packages.
- Configure a RevenueCat customer management or portal URL.
- Keep the RevenueCat webhook deployed and authorized.
- Run RevenueCat sandbox/test web purchases and customer-management flows before enabling public paid conversion.

## RevenueCat Mapping

Configured identifiers:

| Membership | RevenueCat entitlement | Packages | Product ids |
| --- | --- | --- | --- |
| Collector | `Collector` | `collector_monthly`, `collector_yearly` | `tradingdocks.collector.monthly`, `tradingdocks.collector.yearly` |
| Seller | `Seller` | `seller_monthly`, `seller_yearly` | `tradingdocks.seller.monthly`, `tradingdocks.seller.yearly` |
| Store | `Store` | `store_monthly`, `store_yearly` | `tradingdocks.store.monthly`, `tradingdocks.store.yearly` |

Free has no paid RevenueCat entitlement.

## Web Billing Configuration

RevenueCat Web Purchase Links should receive the Supabase auth UUID as `app_user_id`; this keeps web and mobile purchases tied to the same RevenueCat customer.

Required or supported environment variables:
- `REVENUECAT_WEB_PURCHASE_LINK`: shared fallback RevenueCat Web Purchase Link.
- `REVENUECAT_WEB_COLLECTOR_MONTHLY_URL`: optional package-specific Collector monthly link.
- `REVENUECAT_WEB_COLLECTOR_YEARLY_URL`: optional package-specific Collector yearly link.
- `REVENUECAT_WEB_SELLER_MONTHLY_URL`: optional package-specific Seller monthly link.
- `REVENUECAT_WEB_SELLER_YEARLY_URL`: optional package-specific Seller yearly link.
- `REVENUECAT_WEB_STORE_MONTHLY_URL`: optional package-specific Store monthly link.
- `REVENUECAT_WEB_STORE_YEARLY_URL`: optional package-specific Store yearly link.
- `REVENUECAT_WEB_CUSTOMER_PORTAL_URL`: preferred customer management URL.
- `REVENUECAT_WEB_MANAGEMENT_URL`: fallback customer management URL.

The server appends:
- `app_user_id`
- `package_id`
- `email` when available
- `return_url`

If the purchase or customer-management URL is absent or malformed, the API returns a configuration-unavailable response. The browser never grants paid access from checkout UI state; entitlements still require RevenueCat webhook reconciliation into canonical backend membership.

## Stripe Retirement

Production active-subscriber gate:
- The production Stripe subscriber SQL gate was run successfully.
- Result: zero rows / no active legacy Stripe membership subscribers.

Retired direct membership billing files:
- `src/app/api/billing/checkout/route.ts`
- `src/app/api/billing/portal/route.ts`
- `src/app/api/billing/webhook/route.ts`
- `src/lib/stripe/server.ts`
- `src/lib/stripe/plans.ts`
- `src/components/billing/CheckoutButton.tsx`
- `src/components/billing/PortalButton.tsx`

Historical schema remains:
- `supabase/migrations/202607270006_stripe_billing.sql`
- `supabase/migrations/202608070001_revenuecat_subscription_reconciliation.sql`
- `billing_subscriptions.stripe_customer_id`, `stripe_subscription_id`, and `stripe_price_id`

These columns should not be dropped without a later reviewed cleanup migration.

## Stripe Environment Variables

After RevenueCat web billing is confirmed in production, the following Stripe membership variables should be reviewed for removal from membership runtime configuration:
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_COLLECTOR_MONTHLY_PRICE_ID`
- `STRIPE_COLLECTOR_ANNUAL_PRICE_ID`
- `STRIPE_SELLER_MONTHLY_PRICE_ID`
- `STRIPE_SELLER_ANNUAL_PRICE_ID`
- `STRIPE_STORE_MONTHLY_PRICE_ID`
- `STRIPE_STORE_ANNUAL_PRICE_ID`

Do not remove any Stripe configuration that still supports approved marketplace, invoice, or non-membership payment work without a separate audit.

## Safety Rules

- Client RevenueCat customer info may inform UX but must not authorize protected server mutations.
- `user_roles.owner` and `user_roles.admin` remain trusted platform authority and are not fake paid subscriptions.
- Ordinary users must not gain capabilities from editable profile state, localStorage, request params, or client-provided entitlements.
- Stripe metadata must not grant commercial paid access after this cutover.
- Manual admin membership overrides remain explicit product-entitlement overrides and do not modify commercial billing state.
