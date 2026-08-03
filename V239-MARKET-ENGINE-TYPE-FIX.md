# Trading Docks v239 — Market engine TypeScript fix

Fixed the Vercel TypeScript error in:

`src/lib/market-engine/index.ts`

## Root cause

`Object.fromEntries()` inferred the initialized empty arrays as `never[]`.
As a result, accessing `first.source` and `first.dataQuality` failed during
type checking.

## Fix

- Replaced the inferred object construction with an explicitly typed
  `Record<GameId, MarketCard[]>`.
- Added typed market-entry tuples.
- Added a typed `createGameStatus()` helper.
- Preserved all five game adapters and the complete Market Intelligence UI.
