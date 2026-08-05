# Trading Docks OS

Trading Docks OS is a Next.js and Expo platform for trading-card collectors,
sellers, stores, and internal operations.

## Active Application Paths

- Implemented: `src/` is the active Next.js web application.
- Implemented: `mobile/` is the active Expo application.
- Implemented: `supabase/` contains the active migration and SQL infrastructure.
- Implemented: `cloudflare/` contains the inbound email worker source.
- Implemented: `docs/` contains the current architecture, product, security,
  membership, and repository-health documentation.
- Historical Backup: `mobile_backup/`, `mobile-sdk54-clean-backup/`, and
  `mobile-sdk57-backup/` are retained snapshots and are excluded from active
  lint scope.

## Current Stack

- Next.js 16
- React 19
- Tailwind CSS
- Supabase
- Stripe
- Expo SDK 54
- React Native 0.81

## Local Web Development

```powershell
npm install
npm run dev
```

Open the local URL shown in the terminal, normally `http://localhost:3000`.

## Local Mobile Development

```powershell
cd mobile
npm install
npm run web
```

Use the mobile package scripts for Expo-specific linting, tests, type checking,
and web export validation.

## Production Build

```powershell
npm run build
npm start
```

## Environment Variables

Copy the relevant example environment file to `.env.local` or the Expo
environment file used for local development and supply your own values.

Never commit `.env.local`, service-role keys, API secrets, database passwords,
or provider credentials.

## Repository Hygiene

Git history is the authoritative record of former versions. Do not keep new
versioned copies of source files, old ZIP iterations, generated exports, or
dependency-install artifacts in the active repository tree. See
`docs/REPOSITORY_CLEANUP_PLAN.md` for the current cleanup inventory and phased
stabilization plan.
