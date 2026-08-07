# RevenueCat Membership Sync

Status: Planned; release blocker for paid access.

## Required Server Flow

RevenueCat webhook
-> Trading Docks trusted backend endpoint
-> validate RevenueCat event and webhook authorization
-> map RevenueCat `appUserID` to Supabase auth user UUID
-> map active entitlement to canonical membership tier
-> update canonical billing/subscription records
-> mobile and web refresh resolved access from backend membership

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

| RevenueCat entitlement | Trading Docks membership |
| --- | --- |
| `Collector` | `collector` |
| `Seller` | `seller` |
| `Store` | `store` |
| none | `free` |

If multiple paid entitlements appear, effective provider tier is `Store > Seller > Collector`.

## Security Requirements

- The webhook secret and any RevenueCat REST API secret must stay server-side only.
- Mobile clients must never write canonical paid membership directly after purchase or restore.
- Web Stripe subscriptions and mobile Apple/Google subscriptions must both reconcile into provider-specific subscription data plus a canonical effective membership.
- Admin/manual overrides must stay explicit and separate from platform role.

## Current Repository Status

- Implemented: Mobile builds a reconciliation contract with `clientMayGrantEntitlements: false`.
- Implemented: Tests verify the client does not call local account promotion from RevenueCat snapshots.
- Planned: A trusted webhook route or Supabase Edge Function is still required.
- Requires Production Configuration: RevenueCat webhook signing/authorization and staging replay must be completed before paid mobile access is production-ready.
