# Trading Docks Admin v42

Install this ZIP into a new folder named `trading-docks-v42`. Do not extract it
over `trading-docks-v38-clean`.

```powershell
Set-Location "$env:USERPROFILE\Documents"
Expand-Archive "$env:USERPROFILE\Downloads\Trading-Docks-Admin-Tools-v42.zip" `
  -DestinationPath ".\trading-docks-v42" -Force
Copy-Item ".\trading-docks-v38-clean\.env.local" ".\trading-docks-v42\.env.local" -Force
Set-Location ".\trading-docks-v42"
npm install
npm run build
npm run dev
```

Open `http://localhost:3000/dashboard/admin`. The header must say
`v42 · Admin tools visible`. If it does not, a different development server or
folder is still running.

Apply the included Supabase migrations in filename order if they have not
already been applied.
