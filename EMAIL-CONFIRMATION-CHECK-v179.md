# Email confirmation check repair — v179

This release fixes the inbound-email verification screen and aligns the Cloudflare Worker with the deployed Trading Docks receiver.

## Fixed

- **Check for confirmation** remains available as a retry instead of becoming permanently disabled after a failed status request.
- The button visibly changes to **Checking…** while the request is running.
- A pending check now reports that no email has arrived yet instead of appearing to do nothing.
- A failed check reports the API error and can be retried.
- A successful check clearly confirms that the first message reached Trading Docks.
- The Cloudflare Worker now uses the existing `TD_WEBHOOK_SECRET` binding.
- Private recipient tokens from 18 through 64 hexadecimal characters are accepted, including the current 20-character workspace address.
- The Worker posts directly to the production Trading Docks webhook and uses the signature format expected by the deployed receiver.

## Deployment

1. Deploy this application version to Vercel.
2. Replace the Cloudflare Email Worker code with `cloudflare/trading-docks-inbound-email.js` and deploy it.
3. Keep the existing `TD_WEBHOOK_SECRET`; do not generate or change the secret.
4. Keep the `inbound.tradingdocks.com` catch-all rule enabled and connected to `trading-docks-inbound-email`.
5. Send a new test email to the private address, wait a few seconds, and select **Check for confirmation**.

No new Supabase migration, DNS change, or Vercel environment variable is required.
