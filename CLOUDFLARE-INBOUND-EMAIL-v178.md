# Trading Docks v178 — Cloudflare inbound email

This release activates the secure receiving layer for workspace-specific order-email addresses.

## 1. Apply the Supabase migration

Run `supabase/migrations/202608010002_cloudflare_inbound_email.sql` in the Supabase SQL Editor.

## 2. Create one shared secret

Generate a long random value locally:

```bash
openssl rand -hex 32
```

Add the result to Vercel as:

```text
CLOUDFLARE_EMAIL_WEBHOOK_SECRET=the-generated-value
```

Apply it to Production, Preview, and Development, then redeploy Trading Docks.

## 3. Configure the Cloudflare Email Worker

In the `trading-docks-inbound-email` Worker:

1. Replace the placeholder code with `cloudflare/trading-docks-inbound-email.js`.
2. Open **Settings → Variables and Secrets**.
3. Add secret `WEBHOOK_SECRET` using exactly the same value saved in Vercel.
4. Add variable `WEBHOOK_URL` with:
   `https://www.tradingdocks.com/api/webhooks/cloudflare-email`
5. Deploy the Worker.

Never paste either secret into source code or commit it to GitHub.

## 4. Connect the routing rule

In **Email Routing → Routing rules** for `inbound.tradingdocks.com`:

1. Edit the catch-all rule.
2. Change its action from **Drop** to **Send to a Worker**.
3. Select `trading-docks-inbound-email`.
4. Enable and save the rule.

## 5. Verify

Open **Marketplaces → Email Tracking** in Trading Docks. Copy the private address shown for the active workspace, send a test email, wait several seconds, and select **Check for confirmation**.

The message is stored for review. This release intentionally does not deduct inventory automatically. Duplicate raw messages are rejected using a per-workspace SHA-256 fingerprint.

## Security behavior

- HMAC-SHA256 authentication between Cloudflare and Vercel
- Five-minute replay window
- Random, non-predictable workspace mailbox tokens
- 10 MB message limit
- Unknown and disabled recipients rejected
- Duplicate-message protection
- Workspace-scoped row-level read access
- Raw email is never exposed through the webhook response
