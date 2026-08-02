# Cloudflare inbound email setup — v178

## 1. Supabase

Run `00_CLOUDFLARE_INBOUND_EMAIL_RUN_IN_SUPABASE.sql` once in the Supabase SQL Editor.

## 2. Create one shared secret

Create a long random secret (at least 32 characters). Add the same value in both places:

- Vercel environment variable: `CLOUDFLARE_EMAIL_WEBHOOK_SECRET`
- Cloudflare Worker secret: `TD_WEBHOOK_SECRET`

Never paste the secret into source code or a public environment variable.

## 3. Cloudflare Worker

Open `trading-docks-inbound-email` in Cloudflare, select **Edit code**, and replace the placeholder with the complete contents of:

`cloudflare/trading-docks-inbound-email-worker.js`

Deploy the Worker. Then return to Email Routing for `inbound.tradingdocks.com`, edit Catch-all, select **Send to a Worker**, choose `trading-docks-inbound-email`, and enable the rule.

## 4. Vercel

Redeploy Trading Docks after adding the environment variable. The deployed receiver is:

`https://www.tradingdocks.com/api/webhooks/cloudflare-email`

## 5. Verify

Open Trading Docks → Marketplaces → Email Tracking. Copy the new private address, add it as the Gmail or Outlook forwarding destination, and send the confirmation. Select **Check for confirmation**. The status changes to **Email import active** after the first valid message arrives.

## Safety behavior

- Every workspace receives a random, non-guessable address.
- Cloudflare requests are HMAC signed and expire after five minutes.
- Duplicate messages are ignored.
- Messages over 2 MB are rejected.
- The private randomized address and signed Cloudflare webhook prevent unauthenticated workspace routing.
- Recognized orders enter Universal Orders; uncertain messages remain in the review queue.
- Inventory is not automatically deducted by this release.
