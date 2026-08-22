# Trading Docks Performance Production Readiness

Status labels:

- Measured: produced by local production build/server measurement in this pass.
- Observed: confirmed through source/build inspection.
- Static analysis: risk identified by code review or build artifacts; requires runtime QA before closing.
- Follow-up: not a launch blocker unless reproduced as user-facing performance failure.

## Current Checkpoint

- Branch: `codex/production-launch-hardening`
- Scope: public web runtime, Next.js rendering boundaries, static asset weight, public API caching, dashboard query patterns, and launch observability.
- Local production server: `npm run build` followed by `npm run start -- -p 3010`.
- Browser measurement method: Playwright Chromium route navigation with response counting and browser navigation timing.
- Authenticated workspace measurement: not performed in this environment because representative account sessions were not available.

## Performance Baseline

### Initial Measured Failure

Before this pass, a local production build with the repository's current local web environment returned HTTP 500 for public routes:

| Route | Status | Root cause |
| --- | --- | --- |
| `/` | 500 | Supabase server client was created from middleware/homepage code even when public web Supabase config was absent. |
| `/pricing` | 500 | Same middleware Supabase client creation failure. |
| `/sign-in` | 500 | Same middleware Supabase client creation failure. |

This was a runtime hardening issue, not a valid Core Web Vitals baseline.

### Final Measured Public Baseline

After the runtime and asset fixes, the same local production build served public routes successfully:

| Route | HTTP | Measured elapsed | DOM content loaded | Load event | Requests | Largest measured image |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| `/` | 200 | 2245 ms | 225 ms | 225 ms | 24 | Trading Docks mark optimized at `w=96`, 6212 bytes |
| `/pricing` | 200 | 2170 ms | 158 ms | 158 ms | 26 | No large route image observed |
| `/sign-in` | 200 | 2193 ms | 182 ms | 182 ms | 23 | Trading Docks mark optimized at `w=64`, 3506 bytes |

Notes:

- The measured elapsed value includes an intentional two-second settle window after `load`; it should not be read as Lighthouse LCP.
- Browser response headers in the local Next production server did not provide content length for most generated JS/CSS chunks, so bundle weight is reported from build artifacts below.
- No Lighthouse or real-user Core Web Vitals data was collected in this coding environment.

## Rendering Boundaries

- Observed: public `/pricing`, legal pages, icon routes, and several small API routes build as static/revalidated routes.
- Fixed: `/` no longer requires Supabase public configuration just to render locally; the defensive signed-in redirect now skips Supabase client creation when public config is missing.
- Observed: `/sign-in` remains dynamic because it renders auth form behavior and environment-aware sign-in state.
- Observed: dashboard, admin, inventory, orders, CRM, collection, purchasing, and Label Studio routes remain dynamic and session/workspace-bound as expected.

## Client Bundle Findings

Static build artifact review found several sizeable generated assets:

| Asset class | Largest observed local build artifact |
| --- | ---: |
| CSS chunk | 568434 bytes on disk |
| JS chunk | 247834 bytes on disk |
| JS chunk | 227315 bytes on disk |
| JS chunk | 176223 bytes on disk |

Assessment:

- Static analysis: public page JS/CSS is acceptable for beta only after real deployed Web Vitals are observed.
- P1 follow-up: dashboard workspaces include many client components and should be split further only after route-level bundle analysis identifies the highest-impact boundaries.
- P1 follow-up: run `next build --profile` or bundle analyzer in a dedicated optimization pass before broad public launch.

## Image Findings

Fixed:

- Auth, public landing, brand, and dashboard shell logo/mark usages were requesting oversized optimized variants, including a measured `w=1080` Trading Docks mark around 193 KB.
- The same surfaces now use explicit small dimensions and `sizes` hints. Final local measurement observed `w=96` on `/` and `w=64` on `/sign-in`.

Static analysis:

- Large source brand images remain in `public/`, including horizontal/logo PNG files around 1 MB and mark PNG files around 566 KB. Next image optimization now keeps public route requests small, but source assets should be converted to smaller production masters in a brand-asset cleanup pass.
- Inventory, Collection, Deck Vault, and Deck Architect surfaces still render many card images. Many use lazy loading/decoding, but populated-account browser QA is required before closing image performance for large collections/decks.

## Font Findings

- Observed: no `next/font`, external Google Fonts import, or third-party font script was found in the active source.
- Observed: `globals.css` uses an `Inter, ui-sans-serif, system-ui` stack without loading Inter from the network.
- Assessment: no font-related production blocker found. If brand typography later requires a webfont, load it with `next/font` and define a CLS-safe fallback.

## Database And Query Findings

Observed:

- Collector workspace reads are paginated with deterministic page-size behavior and page merging.
- TCGplayer catalog import is resumable and bounded, not a single long-running full-catalog HTTP request.
- Platform access resolution uses trusted server/database authority and does not rely on client-only state for privileged routes.

Static analysis risks:

- Collector supporting reads for locations/trade/wishlist include bounded `limit(1000)` patterns that need large-account verification.
- Business Command Center reads several workspace metrics in parallel, but uses exact counts and up to 1000-row reads for inventory/listing summaries. This is acceptable for beta, but needs query-plan verification with large seller/store workspaces.
- Analytics, inventory aging, and dashboard summary pages need representative populated workspace timing before public launch.

## API Waterfalls And Caching

Fixed:

- Public landing MarketSection previously fetched `/api/multi-game-market` with `cache: "no-store"` from the browser. Local measurement showed the market feed could take about 1798 ms and participate in the homepage waterfall.
- The public market feed now uses browser/server cacheable semantics: client fetch uses `force-cache`, and the API route includes `max-age`, `s-maxage`, and `stale-while-revalidate`.

Observed:

- User/workspace-specific API routes should not receive broad public caching. No global cache change was applied to protected data routes.
- Dashboard server work generally uses parallel fetches where found, including portfolio/access/business-summary paths.

## Loading And Runtime States

- Observed: dashboard has a route-level loading component.
- Static analysis: several authenticated heavy surfaces still rely on component-level empty/loading states. This is likely acceptable for beta, but populated-account QA should verify no full-page blank states during slow Supabase/provider responses.
- Fixed: public routes now fail gracefully when public Supabase configuration is absent instead of crashing from middleware/session probes.

## Third-Party Scripts

- Observed: no active Sentry, PostHog, Vercel Analytics, Speed Insights, or marketing script package was found in the active dependency/runtime scan.
- Observed: `next.config.ts` limits scripts through CSP and does not show arbitrary third-party script domains.
- Follow-up: add production error and Web Vitals monitoring before broad launch. Vercel Speed Insights plus one error-monitoring provider would close this visibility gap.

## SEO And Crawl

- Observed: public routes build and serve without auth requirements after this pass.
- Static analysis: SEO metadata was not exhaustively audited in this phase. Public marketing metadata should be validated separately with deployed preview URLs and social cards.

## Fixes Made

- Added pure Supabase proxy-routing helpers so public routes can avoid unnecessary session lookup.
- Hardened Supabase proxy behavior when public config is absent.
- Made homepage defensive auth redirect config-aware.
- Reduced Trading Docks logo/mark image request sizes across public auth, landing, and dashboard shell surfaces.
- Changed public multi-game market feed from a no-store browser waterfall to cacheable public data.
- Added regression coverage for proxy route classification, config detection, safe homepage auth redirect, public market caching, and logo sizing.

## Remaining Performance Risks

### P0

- None discovered in this pass after the public-route runtime fix.

### P1

- Authenticated dashboard performance has not been measured with real Free, Collector, Seller, Store, and Owner/Admin sessions.
- Large workspace query plans need verification for Business Command Center, inventory aging, Collection supporting joins, Analytics, Orders, and CRM.
- The largest CSS/JS chunks need route-level bundle attribution before broad public launch.
- Production Web Vitals/error monitoring is not yet confirmed.
- Image-heavy deck/collection pages need populated-account QA to confirm lazy loading, intrinsic sizing, and no layout shifts.

## Recommended Next Performance QA

1. Run deployed Preview Lighthouse/WebPageTest for `/`, `/pricing`, `/sign-in`, and `/sign-up`.
2. Run authenticated browser timing for representative Free, Collector, Seller, Store, and Owner/Admin dashboards.
3. Capture Supabase query plans for Business Command Center, Collection list/search, Orders list, CRM list/detail, Analytics, and Deck Vault.
4. Add production Web Vitals and error monitoring before opening beyond closed beta.
5. Use route-level bundle analysis to target the largest dashboard client boundaries instead of broad refactoring.

## GO / NO-GO

- Public web runtime performance readiness: GO for closed beta after validation passes.
- Authenticated dashboard performance readiness: NO-GO for broad production until real-account timing and query-plan verification are completed.
- Overall performance launch posture: GO for controlled beta, NO-GO for unrestricted public launch without monitoring and large-workspace validation.
