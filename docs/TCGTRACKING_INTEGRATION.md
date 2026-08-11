# TCGTracking Integration

Status: Partially Implemented

TCGTracking is integrated as a provider foundation for product identity enrichment, SKU-level pricing enrichment, scanner candidates, sealed-product data, and cross-market mapping. Trading Docks remains the canonical application/data authority.

## Provider Capabilities

Status: Partially Implemented

The server-side provider layer lives in `src/lib/providers/tcgtracking/` and models:

- `GET /meta`
- `GET /categories`
- `GET /{category}/sets`
- `GET /{category}/sets/{set}`
- `GET /{category}/sets/{set}/cards`
- `GET /{category}/sets/{set}/sealed`
- `GET /{category}/sets/{set}/pricing`
- `GET /{category}/sets/{set}/skus`
- `GET /products/{product_id}`
- `GET /{category}/search?q=`
- `POST /scan`

The client centralizes base URL, timeout, retry, user-agent, and future API-key support. Raw provider fetch calls should not be added to UI components.

## Endpoint Usage

Status: Partially Implemented

Initial production-safe usage:

- Admin/Owner provider health check through `/api/admin/tcgtracking/status`.
- Typed parsing and normalization for categories, sets, products, SKUs, pricing, sealed products, and scanner candidates.
- Scanner adapter returns candidates only. It does not mutate inventory.
- Identity reconciliation compares provider rows to existing Trading Docks catalog identity.

Planned usage:

- Bounded admin sync jobs for Magic product metadata and SKU pricing.
- Cached SKU market snapshots for card inspectors, seller repricing, sealed buying, and precon intelligence.
- Scanner benchmark harness comparing TCGTracking candidates to the existing Trading Docks recognition pipeline.

## Cache Policy

Status: Planned

TCGTracking should not be called live from every card render.

Recommended cache behavior:

- Static product/set data: cache for at least 7 days.
- SKU/pricing data: refresh daily.
- Normal card render, Deck Vault inspector, Collection inspector, and seller inventory should read from local cache.
- Provider outages should degrade to cached/local Trading Docks data.

Proposed non-authoritative tables:

- `tcgtracking_products`: static product, set, image, and cross-market identity enrichment.
- `tcgtracking_skus`: SKU-level condition, variant/finish, language, and listing identity.
- `tcgtracking_price_snapshots`: daily pricing and listing-depth snapshots by exact SKU.
- `tcgtracking_sync_runs`: bounded admin sync checkpoints, errors, and freshness.

No migration has been applied in this branch.

## Identity Model

Status: Partially Implemented

`tcgplayer_magic_catalog` remains the local exact-SKU authority. TCGTracking enriches and reconciles against it; it does not replace it.
tcgplayer_magic_catalog remains the local exact-SKU authority.

Product identity can represent:

- game/category
- set
- product
- TCGplayer Product ID
- Scryfall ID
- MTGJSON UUID
- CardTrader ID
- Cardmarket ID
- collector number
- set abbreviation
- exact image URL

SKU identity can represent:

- TCGplayer SKU ID
- TCGplayer Product ID
- condition
- variant/finish
- variant ID
- language

When provider data disagrees with the local catalog, reconciliation records a conflict. It does not overwrite trusted local identity silently.

## Pricing Freshness

Status: Partially Implemented

The shared market snapshot model supports:

- TCG Market
- TCG Low
- TCG High
- active listing count
- Manapool Low
- freshness state
- market spread
- cross-market spread
- liquidity label

Derived metrics use explicit formulas:

- `spreadPercent = (tcgMarket - tcgLow) / tcgMarket`
- `crossMarketSpread = tcgLow - manapoolLow`
- liquidity thresholds: High at 50+ listings, Medium at 12-49 listings, Low below 12 listings.

These values should remain visible when used in product surfaces.

## Scanner Architecture

Status: Partially Implemented

TCGTracking `POST /scan` is represented as a scanner candidate provider. It accepts a pre-cropped full-card image and returns candidate product identities.

Scanner contract:

- TCGTracking scan may return candidate TCGplayer Product IDs.
- Trading Docks maps candidate IDs through the identity bridge and local catalog.
- User must still confirm exact printing, condition, finish, and language.
- No inventory mutation happens on ambiguous or unresolved matches.
- Provider failure falls back to existing scanner behavior.

Production recognition authority has not been switched to TCGTracking.

## Scanner Benchmark

Status: Planned

Benchmark TCGTracking against the current Trading Docks scanner using a repeatable private fixture set:

- normal Magic cards
- foil cards
- showcase
- borderless
- extended art
- older frame cards
- promos
- same artwork across multiple printings
- difficult collector numbers

Metrics:

- top-1 accuracy
- top-N accuracy
- latency
- unresolved rate
- incorrect-printing rate

Do not reduce confirmation requirements until benchmark evidence supports it.

## Image Fallback Strategy

Status: Partially Implemented

Preferred exact-product image priority:

1. Existing Trading Docks exact cached image.
2. Known exact product image URL on the Trading Docks identity.
3. TCGTracking exact product CDN URL.
4. Scryfall exact-printing fallback.
5. Graceful unavailable state.

Do not use card-name-only image fallback when exact product identity exists.

## Sealed Strategy

Status: Partially Implemented

TCGTracking sealed product data should enrich the existing sealed buying and sealed inventory surfaces. Sealed products must not be mixed into single-card catalog tables.

Supported sealed concepts:

- booster boxes
- collector boxes
- bundles
- packs
- Commander/preconstructed decks
- starter products
- other sealed SKUs

Future cache tables should include a sealed product kind or separate sealed cache structure before broad UI rollout.

## Precon Strategy

Status: Planned

TCGTracking sealed pricing can improve Commander precon economics when paired with existing singles pricing. Any Break/Hold guidance must expose its inputs:

- sealed market
- singles market value
- liquid singles estimate
- fees
- estimated net
- ROI

Do not show opaque recommendations without complete inputs.

## Multi-TCG Roadmap

Status: Partially Implemented

Core provider types use category, set, product, and SKU instead of Magic-only names. Magic-specific enrichment can remain separate where needed.

Lowest-risk future proof of concept after Magic is stable: Pokemon.

## Admin Diagnostics

Status: Partially Implemented

Owner/Admin users can view provider health in System & Integration Health. The status route uses canonical platform-role authorization.

Current diagnostics:

- provider availability
- base URL
- latency
- cache policy
- local schema state

Planned diagnostics:

- last metadata sync
- last pricing sync
- products cached
- SKUs cached
- sync errors
- last scan benchmark result

## Security

Status: Partially Implemented

Provider data is external input. Trading Docks validates:

- IDs
- numbers and currency strings
- arrays
- missing/null payloads
- HTTPS image URLs
- scan candidate confidence

Trading Docks does not render provider HTML and does not trust provider URLs for redirects.

TCGTracking currently requires no authentication, but provider configuration supports adding an API key/header later without spreading credentials through the app.

## Existing Data Reused

Status: Implemented

Reused active systems:

- `tcgplayer_magic_catalog`
- TCGplayer catalog resolver
- Scryfall exact-printing integration
- Deck Vault image fallback and inspector flows
- sealed buying UI and TCGCSV sealed search surface
- scanner candidate architecture
- platform Owner/Admin authorization
- market-intelligence derived-metric patterns

## Risks And Dependencies

Status: Requires Production Configuration

- TCGTracking response shapes should be verified against real API payloads before a large sync migration.
- Cache tables require a forward-only migration proposal and staging replay before production use.
- API rate expectations should be confirmed with the provider before bulk sync.
- Scanner quality must be benchmarked before becoming production recognition authority.
- Provider image URLs should be monitored for hotlinking, CDN expiry, and cache behavior.
