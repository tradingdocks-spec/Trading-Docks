# RevenueCat Membership Sync

Status: Partially Implemented; release blocker until staging replay and Sandbox QA pass.

## Required Server Flow

RevenueCat webhook
-> Trading Docks trusted backend endpoint
-> validate RevenueCat event and webhook authorization
-> map RevenueCat `appUserID` to Supabase auth user UUID
-> map product id to provider subscription state
-> resolve the highest valid provider entitlement across Apple, Stripe, and manual override
-> update canonical billing/subscription records when the winning source is provider-derived
-> mobile and web refresh resolved access from backend membership

Implemented endpoint: `/api/webhooks/revenuecat`.

Webhook authentication uses the RevenueCat `Authorization` header compared against the server-only `REVENUECAT_WEBHOOK_AUTHORIZATION` value. The secret must not use `EXPO_PUBLIC_` or `NEXT_PUBLIC_`.

## Event Coverage

The webhook contract must handle:

- `INITIAL_PURCHASE`
- `RENEWAL`
- `PRODUCT_CHANGE`
- `CANCELLATION`
- `UNCANCELLATION`
- `EXPIRATION`
- `BILLING_ISSUE`

## Mapping

| RevenueCat product id | Trading Docks membership |
| --- | --- |
| `tradingdocks.collector.monthly` | `collector` |
| `tradingdocks.collector.yearly` | `collector` |
| `tradingdocks.seller.monthly` | `seller` |
| `tradingdocks.seller.yearly` | `seller` |
| `tradingdocks.store.monthly` | `store` |
| `tradingdocks.store.yearly` | `store` |

If multiple valid paid providers exist, effective tier is `Store > Seller > Collector`. A canceled RevenueCat subscription remains valid until its `expiration_at_ms` passes. Expired, incomplete, unpaid, or stale provider records fall back to Free unless another provider remains valid.

## Provider State

- Implemented: `billing_provider_events` records RevenueCat event ids for audit and duplicate-delivery idempotency.
- Implemented: `billing_provider_subscriptions` stores Apple/Google provider subscription state separately from Stripe customer identifiers.
- Implemented: `billing_subscriptions` remains the canonical effective membership row consumed by current web/mobile access resolution.
- Implemented: Existing Stripe rows continue to participate in effective membership resolution.
- Implemented: `admin_membership_overrides` keeps precedence through the existing server access layer; the RevenueCat webhook does not rewrite manual overrides.

## Security Requirements

- The webhook secret and any RevenueCat REST API secret must stay server-side only.
- Mobile clients must never write canonical paid membership directly after purchase or restore.
- Web Stripe subscriptions and mobile Apple/Google subscriptions must both reconcile into provider-specific subscription data plus a canonical effective membership.
- Admin/manual overrides must stay explicit and separate from platform role.

## Current Repository Status

- Implemented: Mobile builds a reconciliation contract with `clientMayGrantEntitlements: false`.
- Implemented: Tests verify the client does not call local account promotion from RevenueCat snapshots.
- Implemented: A trusted Next.js webhook route exists at `/api/webhooks/revenuecat`.
- Implemented: The webhook handles `INITIAL_PURCHASE`, `RENEWAL`, `PRODUCT_CHANGE`, `CANCELLATION`, `UNCANCELLATION`, `EXPIRATION`, `BILLING_ISSUE`, duplicate delivery, malformed payloads, and unknown event types.
- Requires Production Configuration: Configure the RevenueCat dashboard webhook URL, set the server-only authorization secret, apply the migration in staging/production after review, and complete Sandbox purchase/restore replay before paid mobile access is production-ready.

## RevenueCat Dashboard Setup

1. Open RevenueCat project settings for the Trading Docks app.
2. Add webhook URL `https://<production-domain>/api/webhooks/revenuecat`.
3. Set the webhook `Authorization` header to the same value as server env `REVENUECAT_WEBHOOK_AUTHORIZATION`.
4. Send Sandbox test events for every product id before enabling production unlocks.
5. Confirm duplicate delivery returns success without changing membership twice.
