# Trading Docks Stripe Billing setup

This release includes subscription checkout, monthly and annual prices, signed
webhooks, Supabase plan access, Stripe's customer billing portal, and billing
status in Settings.

## 1. Apply the Supabase migration

Open **Supabase → SQL Editor** and run:

`supabase/migrations/202607270006_stripe_billing.sql`

## 2. Configure local environment variables

Copy `.env.local.example` to `.env.local`. Fill in:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

The six test Price IDs are already included. Keep every secret out of Git.

## 3. Configure Stripe Customer Portal

In **Stripe test mode → Settings → Billing → Customer portal**, enable:

- Update payment method
- Cancel subscriptions
- Switch plans and billing periods
- Invoice history

Add all six Collector, Seller, and Store prices to the portal's product catalog.

## 4. Test webhooks locally

Install and sign in to the Stripe CLI, then run:

```powershell
stripe listen --forward-to localhost:3000/api/billing/webhook
```

Copy the displayed `whsec_...` value to `STRIPE_WEBHOOK_SECRET` in `.env.local`,
then restart the development server.

## 5. Test checkout

Use Stripe's test card:

```text
4242 4242 4242 4242
Any future expiration
Any three-digit CVC
Any postal code
```

Confirm that:

1. Checkout returns to `/dashboard/billing/success`.
2. Supabase `billing_subscriptions` contains the subscription.
3. The correct paid features unlock.
4. **Settings → Manage billing** opens the Stripe portal.
5. Canceling or changing the plan updates Supabase after the webhook arrives.

## 6. Configure Vercel test deployment

Add the same environment variables in Vercel. Set:

```text
NEXT_PUBLIC_SITE_URL=https://trading-docks.vercel.app
```

In Stripe test mode, create a webhook endpoint:

```text
https://trading-docks.vercel.app/api/billing/webhook
```

Subscribe it to:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`

Use that endpoint's unique signing secret in Vercel.

## 7. Go live

Stripe test and live data are separate. Before launch:

1. Recreate the three products and six prices in live mode.
2. Replace all six Price IDs with their live `price_...` values.
3. Use the live secret and publishable keys.
4. Create a live production webhook and use its signing secret.
5. Set `NEXT_PUBLIC_SITE_URL` to the final Trading Docks domain.
6. Complete one low-value real checkout and cancellation test.

Never expose `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, or
`SUPABASE_SERVICE_ROLE_KEY` in browser code or commit them to Git.
