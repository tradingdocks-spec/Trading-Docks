# Trading Docks

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
