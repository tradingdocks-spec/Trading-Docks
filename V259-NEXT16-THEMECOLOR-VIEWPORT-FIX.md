# Trading Docks v259 — Next.js 16 themeColor viewport fix

Next.js 16 no longer supports `themeColor` inside the `metadata` export.

The shared root layout now uses:

```ts
export const viewport: Viewport = {
  themeColor: "#07121F",
};
```

Because the warning originated in the root layout, it appeared for every route.
Fixing the shared layout removes the warning across dashboard, authentication,
legal, pricing, onboarding, and not-found pages.

The standalone metadata reference snippet was updated as well.

No Supabase migration is required.
