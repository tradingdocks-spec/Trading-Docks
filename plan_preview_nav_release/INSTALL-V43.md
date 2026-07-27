# Trading Docks Admin v43

This release fixes the Trials & Promotions error:

`Could not load trials: permission denied for table users`

## Database update

Because migrations 001–003 are already installed, open this file:

`supabase\migrations\202607270004_fix_trial_user_permissions.sql`

Copy all of its contents into a new Supabase SQL Editor query and click **Run**.
The expected result is `Success. No rows returned`.

This migration replaces the trial policy's protected `auth.users` lookup with
the signed-in user's Supabase JWT email. It does not grant access to
`auth.users` and does not disable Row Level Security.

## Install and run

Extract this ZIP into a new folder named `trading-docks-v43`. Copy only your
local environment file from v42, then build and start:

```powershell
Set-Location "$env:USERPROFILE\Documents"
Copy-Item ".\trading-docks-v42\.env.local" ".\trading-docks-v43\.env.local" -Force
Set-Location ".\trading-docks-v43"
npm install
npm run build
npm run dev
```

Open `http://localhost:3000/dashboard/admin`, refresh the page, and open
**Trials & Promotions**. The previous `permission denied for table users`
message should be gone.
