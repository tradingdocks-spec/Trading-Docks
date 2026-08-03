# Trading Docks v227 — Mana Pool TypeScript build fix

Fixed the Vercel error in:

`src/app/api/marketplaces/manapool/import/route.ts`

The Mana Pool item mapper always returns a string for `language`, defaulting to
`English`. The type predicate incorrectly declared `language` as
`string | null`.

The predicate now declares:

```ts
language: string;
```

All Mana Pool v1 sync behavior remains preserved.
