# Trading Docks — Binder Removal v20

This package contains the verified binder-actions build.

## Visual installation check

After restarting, open a binder and confirm that the header shows the small
`BINDER ACTIONS V20` badge. Every occupied pocket will also show:

- a permanent rose-colored `REMOVE CARD` button in its bottom bar;
- an always-visible three-dot button in its upper-right corner; and
- the Trading Docks card-actions menu when you right-click anywhere inside it.

If the v20 badge is not visible, a different project folder is running.

## Start the correct project

Open PowerShell in this exact extracted folder, then run:

```powershell
Remove-Item ".\.next" -Recurse -Force -ErrorAction SilentlyContinue
npm install
npm run build
npm run dev
```

Trading Docks is a Next.js operating system for trading-card stores and collectors.

## Current stack

- Next.js 16
- React 19
- Tailwind CSS
- Supabase
- Vercel

## Local development

```powershell
npm install
npm run dev
```

Open the local URL shown in the terminal, normally `http://localhost:3000`.

## Production build

```powershell
npm run build
npm start
```

## Environment variables

Copy the relevant example environment file to `.env.local` and supply your own values.

Never commit `.env.local`, service-role keys, API secrets, or database passwords.

## Deployment

The recommended deployment flow is:

1. Push this repository to GitHub.
2. Import the GitHub repository into Vercel.
3. Add required environment variables in Vercel.
4. Deploy first to a private preview URL.
5. Connect `tradingdocks.com` only after testing.

## Backup policy

Git history is the authoritative record of former versions. Do not keep versioned copies of source files or old ZIP iterations inside the repository. Use tagged releases and branches for milestones.
