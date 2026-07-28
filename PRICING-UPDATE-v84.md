# Trading Docks Pricing Update v84

## Updated annual billing display

- Collector: $3.75/month, billed annually at $44.99
- Seller: $14.99/month, billed annually at $179.99
- Store: $37.49/month, billed annually at $449.99

Monthly billing is selected first by default. Annual billing still shows the
effective monthly price first and the exact annual charge directly below it.

## Pricing card behavior

No paid plan is permanently highlighted. Every plan card now receives the same
highlight, lift, glow, and button treatment when it is hovered.

## Stripe setup reminder

Stripe prices are immutable. Create new annual prices in Stripe for $44.99,
$179.99, and $449.99, then update these Vercel Production variables with the
new annual Price IDs:

- `STRIPE_COLLECTOR_ANNUAL_PRICE_ID`
- `STRIPE_SELLER_ANNUAL_PRICE_ID`
- `STRIPE_STORE_ANNUAL_PRICE_ID`

Redeploy after changing the variables so checkout charges the same totals shown
on the website.
