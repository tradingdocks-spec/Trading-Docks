# Market Intelligence simulated preview

Status: **Implemented** on the public homepage. Local production-route QA completed September 9, 2026. This branch has not been pushed or deployed.

## Behavior

The preview starts with deterministic, game-specific fictional quotes and owned positions. It performs no pricing API requests. Card identities and artwork still use the verified provider manifest documented in [MARKET_ARTWORK_PROVIDERS.md](./MARKET_ARTWORK_PROVIDERS.md).

After hydration, one card updates every 3.2 seconds. Its price, percentage movements, bid/ask, demand, opportunity and unrealized position value come from the same calculation. Quotes can rise or fall; no card receives unbounded random jumps. The updated quote settles with a 550ms, two-pixel opacity/position transition and a small direction indicator. Only the current updated row receives a low-contrast tint. There are no background particles, continuous flashing effects or new animation/chart dependencies.

The featured card displays its current demo quote, a deterministic seven-day SVG path, mode-specific metrics, owned/listed copies, average cost, unrealized gain/loss, an action and a reason. The seven-day path retains its time axis; ticks adjust the endpoint rather than falsely advancing a full day every few seconds.

## Bounds and calculations

- Opening quotes are stable on the server and client. No `Math.random`, wall-clock seed or browser-only value is used to initialize card data.
- Total price drift is capped at ±2.5% of the opening quote. The sinusoidal model normally stays within ±2.2% for high demand and ±1.4% for other cards.
- Individual price steps are capped at 0.3% of the opening quote, with cent rounding and a one-cent minimum step allowance for inexpensive cards. The final rounded quote remains inside the total bound.
- Both 24-hour and seven-day changes are calculated against fixed reference quotes derived from the opening percentages. They remain consistent with the displayed current quote.
- Demand drifts by at most four score points; spread drifts by at most 1.3 percentage points. Sell-through remains between 0% and 100%, and opportunity remains between 0 and 100.
- Opportunity combines demand strength, moderate spread, unlisted copies and seven-day movement. Excess spread above 12% reduces the score to represent uncertainty.
- Unrealized gain/loss is `(current quote − average cost) × owned copies`, rounded to cents. Owned, listed and cost fields remain stable.
- Actions follow ordered thresholds: REVIEW for spread ≥17% or demand <48; otherwise REPRICE listed copies for 24h movement ≤−0.5% or ≥1.8%; otherwise LIST unlisted copies when demand ≥78 and opportunity ≥66; otherwise HOLD. Counts reflect the corresponding listed, unlisted or owned position.

## Signal views

| View | Ranking | Featured and row emphasis |
| --- | --- | --- |
| Balanced signal | Opportunity, owned quantity and recent movement | Opportunity meter and position-based action |
| Price movement | Absolute 24h movement weighted twice, plus absolute 7d movement | 24h/7d changes and row sparklines |
| Demand | Demand strength plus a sell-through contribution | Demand score, fictional 30-day sell-through, owned/listed copies |
| Spread | Demo bid/ask percentage gap | Bid, ask and spread; wider gaps prompt review |

Ranking is captured from the current quotes when a view is selected. Quotes continue to move without shifting rows under the reader or changing the featured printing. The footer explains this behavior. Selecting a game preserves the signal mode and manual pause preference, while starting that game's deterministic opening snapshot.

## Accessibility and performance

The feed starts only when its region is visible, the document is foregrounded, reduced motion is off, and the user has not paused it. The timer is cleared when any condition stops being true or the component unmounts. Intersection and visibility observers and media-query listeners clean up as well.

Reduced-motion users receive static quotes, working signal/game controls and disabled automatic movement; CSS also removes value animations and transitions. Changing the OS preference while the page is open updates the running state. Manual Pause/Resume controls are available and persist across games. Repeated price updates do not use an ARIA live region that would interrupt screen readers.

There is one interval for the active game, no global ticking state, no animation-frame loop, and memoized unchanged rows retain their card-object identities. SVG charts have descriptive accessible labels and meters expose their current values. Fixed artwork and chart dimensions plus steady row order avoid tick-induced layout jumps.

Desktop uses aligned signal rows. Below 600px, the same semantic articles become stacked mobile cards with artwork, readable prices and signal details, rather than a shrunken table. There is no duplicate mobile image tree.

## Changed files

- `src/lib/market-preview.ts`: deterministic model, coherent position calculations, action thresholds, ranking, formatting and disposable tick loop.
- `src/lib/card-artwork/demo-market-artwork.ts`: distinct fictional opening prices for each game.
- `src/components/landing/useDemoMarketTicks.ts`: hydration-safe lifecycle, viewport/document visibility and reduced-motion handling.
- `src/components/landing/MarketSection.tsx`: signal views, position context, charts, meters, movement controls and responsive signal articles.
- `src/components/landing/MarketPreview.module.css`: restrained styling, value transitions, semantic movement colors and mobile layout.
- `tests/market-preview.test.ts`: deterministic initialization, 17,000 simulated card updates, bounds, derived values, action thresholds, ranking, formatting and timer cleanup.
- `tests/e2e/market-preview.spec.ts`: SSR/client equality, reduced motion, ticks, layout stability, pause/offscreen behavior, mode emphasis, mobile articles and interval disposal.
- `tests/public-web-ui.test.ts`: recognize the new local tick hook while retaining the no-provider-fetch assertion.
- `playwright.market.config.ts`: include the simulation browser suite alongside artwork regression tests.
- This document records the model and validation.

## Validation

`npm run check` passes: typecheck, lint (0 errors, 494 existing warnings), all 671 unit tests and zero production audit vulnerabilities. `npm run build` passes.

`npx playwright test --config playwright.market.config.ts` passes all 10 tests. The artwork cases cover every game and signal mode at 1728, 1440, 1024, 430 and 390 pixels (100 combinations). They verify decoded images, contained artwork and no horizontal page overflow. Simulation tests cover actual SSR and hydrated quotes, reduced motion, single-card ticks, stable container height/order, manual pause across games, offscreen pause, meaningful signal content and timer disposal across game changes and navigation.

Manual production-homepage inspection covered all five requested widths: desktop balanced and spread views, tablet Japanese demand, and mobile English Pokémon movement and One Piece position views. Quotes moved subtly, charts stayed legible, artwork remained visible, tabs wrapped and mobile cards kept full-size prices. No hydration errors appeared in the browser regression run. All labels identify the demo; no real-time provider-pricing claim is made. A Lighthouse score comparison was not performed.
