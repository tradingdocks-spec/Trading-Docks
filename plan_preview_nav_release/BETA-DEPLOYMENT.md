# Trading Docks v45 Beta Deployment

This package is ready for a Vercel beta deployment.

## Deploy

1. Replace the existing repository contents with this package.
2. Keep the repository's existing environment variables in Vercel.
3. Commit and push to the beta branch or `main`.
4. Confirm the Vercel deployment finishes successfully.

## Required environment variables

Use `.env.local.example` as the variable-name checklist. Never commit
`.env.local` or paste secret values into source files.

## Local verification

```bash
npm ci
npm run lint
npx tsc --noEmit
npm run build
```

The production build was verified on Linux with Next.js 16.2.11.
