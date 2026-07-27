# Trading Docks v44

## One-time database update

Run `supabase/migrations/202607270005_trial_invitation_tracking.sql` in the
Supabase SQL Editor. A successful result says `Success. No rows returned`.

## Private environment settings

Keep these values in `.env.local` and never send or commit that file:

```env
RESEND_API_KEY=re_your_private_key
RESEND_FROM_EMAIL=Trading Docks <welcome@tradingdocks.com>
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

For real customer invitations, replace `http://localhost:3000` with the public
URL where customers can open Trading Docks. Restart the website after changing
`.env.local`.

## Start v44

```powershell
npm install
npm run build
npm run dev
```

The Admin Control Center now grants a trial and sends its branded invitation in
one action. Open trials also have a **Resend invitation** action and show whether
the latest send succeeded or failed.
