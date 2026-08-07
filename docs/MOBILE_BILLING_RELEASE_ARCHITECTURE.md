# Mobile Billing Release Architecture

Status: Planned for mobile purchases; Partially Implemented for shared entitlements.

Release severity: BLOCKER for paid mobile upgrades; HIGH if the first TestFlight keeps paid mobile purchase UI disabled.

## Current State

- Implemented: The canonical product catalog lives in `mobile/services/membership-catalog.ts` and is adapted by web and mobile.
- Implemented: Web Stripe provider mappings exist separately from product definitions.
- Implemented: Mobile plan cards display Free, Collector, Seller, and Store using the canonical catalog.
- Planned: RevenueCat/StoreKit/Google Play Billing is not active in `mobile/package.json`.
- Requires Production Configuration: Stripe live price identifiers, mobile store products, entitlement webhooks, subscription metadata, restore-purchases behavior, and App Store/Play Store review copy need approval.

## Purchase Classification

| Offering | Classification | Current mobile state | Release requirement |
| --- | --- | --- | --- |
| Free | DIGITAL FEATURE/SUBSCRIPTION | Implemented as no-payment account tier. | Safe if entitlements are server-authoritative. |
| Collector | DIGITAL FEATURE/SUBSCRIPTION | Catalog displayed; purchase not processed. | Must use StoreKit/Google Play Billing or approved compliant architecture for in-app digital access. |
| Seller | DIGITAL FEATURE/SUBSCRIPTION | Catalog displayed; purchase not processed. | Same as Collector. |
| Store | DIGITAL FEATURE/SUBSCRIPTION | Catalog displayed; purchase not processed. | Same as Collector; employee capacity remains pending product configuration. |
| Deal Desk real-world buying | REAL-WORLD SERVICE | Implemented as workflow tooling, not checkout. | Keep separate from mobile subscription billing. |
| Future marketplace/card sales | PHYSICAL GOODS | Not implemented as mobile checkout. | May use external/physical-goods compliant payment flows only after product/legal review. |

## Target Entitlement Flow

Provider purchase
-> provider webhook
-> canonical backend subscription record
-> Trading Docks membership tier and billing status
-> resolved entitlements
-> web and mobile read-only entitlement consumers

The client must never be the authority for paid access. Mobile may show current plan and purchase UI after approval, but protected features must resolve from backend subscription state and RLS/server checks.

## Mobile Payment Provider Decision

- Implemented for the first mobile RC strategy: Option A is Free-only mobile account creation and read-only/display-only paid membership state. Mobile must not process Collector, Seller, or Store upgrades in-app until native subscriptions are approved and implemented.
- Planned: RevenueCat remains the likely cross-platform subscription adapter because the repository already models planned provider mappings.
- Requires Production Configuration: RevenueCat products, Apple subscription group, Google base plans, webhooks, restore purchases, and backend entitlement reconciliation are not configured.
- Implemented: Provider identifiers are separate from plan definitions, so product copy and entitlement keys can remain stable while providers change.

## Paid Upgrade Behavior For This RC

- Implemented: Mobile may display the canonical plan catalog and the user's resolved entitlement state.
- Partially Implemented: Paid tiers can be reflected from backend subscription data when already present.
- Planned: Mobile does not complete paid upgrades, restore purchases, or native receipt validation.
- Release rule: any paid upgrade control must remain disabled, informational, or routed to a product-owner-approved compliant flow. Do not route native iOS users to Stripe checkout for in-app digital subscription access without legal/product approval.

## Release Guardrails

- Do not process paid mobile subscriptions through Stripe inside the native iOS app unless product/legal review confirms an allowed exception.
- Do not show a paid purchase success state until the provider confirms purchase and backend entitlement refresh succeeds.
- Do not grant paid entitlements solely from local account type, admin role, or client purchase receipt.
- Store paid mobile purchase controls behind approved release configuration.
- Keep web Stripe billing and mobile store billing reconciled into the same canonical subscription table.

## Open Decisions

- Product owner must approve whether paid mobile upgrades are in scope for the first TestFlight.
- Product owner/legal must confirm Apple Review classification for Seller and Store tools.
- Product owner must finalize Store employee capacity before marketing copy promises a seat count.
- Engineering must choose whether mobile subscriptions launch with RevenueCat or direct StoreKit/Play Billing.
