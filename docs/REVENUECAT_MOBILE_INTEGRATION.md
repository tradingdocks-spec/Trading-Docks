# RevenueCat Mobile Integration

Status: Partially Implemented.

## Implemented

- `react-native-purchases@10.7.0` is installed in the active Expo app.
- `mobile/services/revenuecat.ts` centralizes public SDK configuration, Supabase UUID identity, entitlement mapping, Offering package lookup, purchase, restore, and provider snapshot normalization.
- `mobile/providers/auth.tsx` configures RevenueCat after Supabase session restoration and on auth-state changes using the Supabase authenticated user UUID as `appUserID`.
- RevenueCat logout/reset runs when the Supabase session is missing or signed out, preventing one Trading Docks account from replaying another account's purchase identity.
- `/plans` uses a custom Trading Docks membership UI rather than a generic RevenueCat paywall.
- The UI displays StoreKit/RevenueCat localized price strings and does not hard-code live display prices.
- Free is not modeled as a RevenueCat purchasable product.

## Requires Production Configuration

- `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` must be configured for EAS development, preview, and production if iOS purchases are enabled.
- `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` must be configured before Android purchase builds.
- RevenueCat Offering must expose these package identifiers: `collector_monthly`, `collector_yearly`, `seller_monthly`, `seller_yearly`, `store_monthly`, and `store_yearly`.
- Apple product identifiers must remain `tradingdocks.collector.monthly`, `tradingdocks.collector.yearly`, `tradingdocks.seller.monthly`, `tradingdocks.seller.yearly`, `tradingdocks.store.monthly`, and `tradingdocks.store.yearly`.

## Planned / Blocked

- Production entitlement activation remains blocked until RevenueCat webhooks reconcile into the canonical Trading Docks backend membership record.
- Physical Sandbox purchase and Restore Purchases QA is still required on a clean EAS iOS build.
- Android purchase QA is planned after Google Play products and public SDK key are configured.

## Authority Rule

RevenueCat is a mobile-store purchase and entitlement provider. It is not the sole source of authorization. Protected mobile, web, and Headquarters access must continue to resolve from the Trading Docks canonical backend membership model.
