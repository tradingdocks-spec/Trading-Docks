# POS Inventory Identity

## Current Status

- Implemented: `src/lib/label-studio/pos-identity.ts` defines the future POS lookup contract.
- Implemented: POS lookup inputs can classify Trading Docks QR, Trading Docks SKU, UPC, barcode, card scanner result, and manual search.
- Implemented: The cart-item contract is separate from QR scanning and does not assume every lookup is a card.
- Planned: Full POS cart, checkout, payment, receipt, refund, tax, and register workflows are outside this checkpoint.

## Lookup Sources

Future POS should resolve all of these into one cart item contract:

- Trading Docks QR
- Trading Docks SKU
- UPC
- barcode
- card scanner result
- manual search

## Cart Item Contract

Implemented fields:

- source
- workspace id
- inventory SKU
- inventory item id
- sealed product id
- item name
- quantity
- unit price
- allowed POS action

## Stripe, RevenueCat, And Billing

- Implemented: This checkpoint does not modify billing behavior.
- Implemented: POS selling permission is a platform capability and does not grant paid membership.
- Planned: Future POS payment processing must remain separate from subscription billing.

## Card Show Workflow

- Partially Implemented: Contracts can render card-show labels and classify QR/SKU scans for future POS add-to-cart behavior.
- Planned: Current-sale context, sale completion, decrement-on-sale, and show reconciliation require server-side inventory mutation design.

## Sealed Workflow

- Partially Implemented: Label templates support `sealed.product_name`.
- Planned: Durable sealed product identity should be included in the migration proposal before sealed labels are production-authoritative.
