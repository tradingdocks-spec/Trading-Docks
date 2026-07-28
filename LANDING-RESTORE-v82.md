# Trading Docks landing-page restore v82

This release keeps the complete v81 route tree and trial-email repair while
making the newest modular landing page the production `/` route.

The active landing page is:

`src/app/page.tsx`

It renders the current components in:

`src/components/landing/`

The old monolithic design remains only in `src/app/page-current-backup.tsx` as
an unused reference and is not imported by the production route.

## Deploy

Extract this ZIP directly into the repository folder containing `package.json`,
allow matching files to be replaced, commit and push the result, then redeploy
the Production deployment without reusing the build cache.

Vercel's Root Directory should remain blank when `package.json` is at the
repository root.
