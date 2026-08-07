# Billing Provider Parity

Status: Partially Implemented

Trading Docks currently has two billing provider paths:

| Provider | Status | Current role |
| --- | --- | --- |
| Stripe | Implemented | Existing web subscription provider and checkout/webhook path. |
| RevenueCat | Requires Production Configuration | Mobile purchase provider reconciled server-side through the RevenueCat webhook. |

## Canonical Rule

Status: Partially Implemented

Billing providers do not define the product catalog. They map external identifiers onto canonical Trading Docks membership tiers.

## Stripe

Status: Implemented

- Stripe webhook writes server-side billing subscription state.
- Existing Stripe behavior must remain unchanged.
- Stripe price identifiers are provider metadata, not product definitions.
- Stripe subscriptions must not be downgraded by expired Apple/RevenueCat state.

## RevenueCat

Status: Requires Production Configuration

- Mobile SDK initializes with the Supabase UUID as the RevenueCat app user id.
- Mobile client must not directly grant paid membership.
- RevenueCat webhook reconciles Apple purchase state into server billing records.
- Required server variables:
  - `REVENUECAT_WEBHOOK_AUTHORIZATION`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL`
- Required mobile public variable:
  - `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY`

## RevenueCat Identifiers

Status: Partially Implemented

| Tier | Package ids | Product ids | Entitlement id |
| --- | --- | --- | --- |
| Collector | `collector_monthly`, `collector_yearly` | `tradingdocks.collector.monthly`, `tradingdocks.collector.yearly` | `Collector` |
| Seller | `seller_monthly`, `seller_yearly` | `tradingdocks.seller.monthly`, `tradingdocks.seller.yearly` | `Seller` |
| Store | `store_monthly`, `store_yearly` | `tradingdocks.store.monthly`, `tradingdocks.store.yearly` | `Store` |

## Provider Parity Findings

| Finding | Severity | Status |
| --- | --- | --- |
| RevenueCat reconciliation is newer and provider-normalized. | P1 | Stripe should eventually use the same provider-state resolution model. |
| Manual override wins in current reconciliation. | P1 | This is explicit but should be audited and reviewed operationally. |
| Apple expiration should not downgrade active Stripe. | P0 | Current effective-membership resolver ranks valid provider subscriptions and ignores expired provider state. |
| RevenueCat route is server-side only. | Implemented | Mobile does not call service-role APIs. |
| RevenueCat production requires exact server env and provider dashboard configuration. | Requires Production Configuration | Confirm in Vercel and RevenueCat before relying on live purchases. |
