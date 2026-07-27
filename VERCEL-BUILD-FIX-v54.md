# Trading Docks Vercel Build Fix v54

This update keeps the root `src` application as the active Trading Docks
codebase and prevents the archived `plan_preview_nav_release` application from
being included in TypeScript and ESLint validation.

## Apply with GitHub Desktop

1. Extract the update ZIP directly into the root of the current Trading Docks
   repository.
2. Allow Windows to replace `tsconfig.json` and `eslint.config.mjs`.
3. In GitHub Desktop, confirm these files changed:
   - `tsconfig.json`
   - `eslint.config.mjs`
   - `VERCEL-BUILD-FIX-v54.md`
4. Commit the changes and push to `main`.

The production build was verified with Next.js 16.2.11 and generated all 62
application routes successfully.
