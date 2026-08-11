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

## Live Provider Validation

Status: Partially Implemented

Validation date: 2026-08-11.

Live endpoint findings:

- API reachable: Yes.
- Metadata version: `1.1`.
- Category count: 62.
- Health check latency observed from the local workstation: 98-2,579 ms across sampled runs.
- Catalog resources use numeric category IDs. Magic is category `1`; `/v1/1/sets` is valid while `/v1/magic/sets` is not.
- Categories are returned in a `{ categories: [...] }` wrapper.
- Sets are returned in a `{ sets: [...] }` wrapper.
- SKU data is returned as a compressed `products.{productId}.{skuId}` map.
- Pricing data is returned as a compressed `prices.{productId}.tcg.{finish}` map.

Provider contract changes made from live validation:

- Magic aliases `magic`, `mtg`, and `Magic: The Gathering` map to category `1`.
- Category, set, SKU, and pricing wrappers are normalized.
- Compact SKU field names are supported: `cnd`, `var`, `var_a`, `vid`, `lng`, `mkt`, `low`, `hi`, `cnt`, and `mp`.
- Compact price maps are flattened into Trading Docks market snapshots.
- Top-level product `id` is treated as the TCGplayer Product ID for Magic product identity.

Products tested:

| Case | Product | Set | TCGplayer Product ID | Collector | Scryfall ID | MTGJSON UUID | Cardmarket | CardTrader | Provider SKUs | Pricing coverage |
| --- | --- | --- | ---: | --- | --- | --- | ---: | ---: | ---: | --- |
| Normal | Arcane Signet | Commander Legends | 226694 | 297 | `ee40458c-7f3a-4fa6-976f-be1f7a336fdc` | `811f0a64-cff0-5a50-817d-b9f26b22b409` | 510735 | 149682 | 90 | Normal and Foil |
| Older frame | Rhystic Study | Prophecy | 7357 | 45 | `3394cefd-a3c6-4917-8f46-234e441ecfb6` | `7691887a-48cf-523b-bd19-c94a756392a2` | 3939 | 29733 | 80 | Normal and Foil |
| Older frame | All Is Dust | Rise of the Eldrazi | 34695 | 1 | `62dba377-7446-4517-a504-ee04568fd6cf` | `ceeeaa92-ff8e-5943-8842-3bb7efa6b673` | 22367 | 18892 | 90 | Normal and Foil |
| Older frame | Lightning Greaves | Mirrodin | 11512 | 199 | `61a28870-cf78-4323-9d82-cee764067764` | `25429a6d-fd7a-5235-a230-f4748b04589d` | 199 | 26029 | 90 | Normal and Foil |
| Borderless | Arcane Signet (Borderless) | Commander Masters | 503407 | 653 | `1836b8a6-c616-4793-933b-b38296d70e72` | `306bac0e-10b2-5db3-9e4b-a36dea8336ac` | 721753 | 252915 | 70 | Normal and Foil |
| Foil-only special | Rhystic Study (Anime Borderless) (Confetti Foil) | Wilds of Eldraine: Enchanting Tales | 509567 | 91 | `8f7f8d7a-e5ad-4c03-8ab3-e9af9c2927b7` | `b2dac0e6-c42a-5f17-9e09-7d3f1380551f` | 728563 | 257413 | 10 | Foil |

SKU and pricing reconciliation:

- Provider SKU records include condition, finish, language, market price, low price, high price, active listing count, and Manapool low where present.
- Provider pricing maps cleanly into `TradingDocksMarketSnapshot`.
- TCGTracking uses compact condition codes (`NM`, `LP`, `MP`, `HP`, `DMG`) while Trading Docks local catalog stores display conditions (`Near Mint`, `Lightly Played`, etc.). Any future cache/write path must normalize aliases before comparing condition agreement.
- The pricing endpoint provides per-finish market/low and Manapool low, but not always per-finish high price. The SKU endpoint includes high price at the condition/SKU level.
- Local `tcgplayer_magic_catalog` comparison could not be completed in this shell because `SUPABASE_SERVICE_ROLE_KEY` is not configured. The read-only validation harness performs that comparison when server credentials are present.

Image reliability:

| Product | Image status | Content type | Observed HEAD latency |
| --- | ---: | --- | ---: |
| Arcane Signet, Commander Legends | 200 | `image/jpeg` | 66 ms |
| Rhystic Study, Prophecy | 200 | `image/jpeg` | 47 ms |
| All Is Dust, Rise of the Eldrazi | 200 | `image/jpeg` | 56 ms |
| Lightning Greaves, Mirrodin | 200 | `image/jpeg` | 53 ms |
| Arcane Signet (Borderless), Commander Masters | 200 | `image/jpeg` | 60 ms |
| Rhystic Study Confetti Foil, Wilds of Eldraine: Enchanting Tales | 200 | `image/jpeg` | 46 ms |

Result: 6 of 6 tested image URLs were reachable and exact-printing aligned with the tested provider product IDs. Keep TCGTracking images as a fallback after existing Trading Docks exact cached images and exact product identity images. Do not change production image priority yet.

Scanner benchmark:

- No real image fixtures are committed in the repository.
- `scripts/tcgtracking/scan-benchmark.ts` provides a private-fixture runner for TCGTracking `POST /scan`.
- The runner requires `--allow-upload` because image fixtures are sent to the provider.
- The runner exports sanitized results only: fixture id, expected labels, candidates, latency, top-1/top-N flags, and unresolved status. It does not export local image paths or image contents.
- No live scanner accuracy numbers are claimed until product-owner-supplied private fixtures are run.

Local commands:

```bash
node --experimental-strip-types scripts/tcgtracking/live-validation.ts --output C:\private\tcgtracking-live-validation.json
node --experimental-strip-types scripts/tcgtracking/scan-benchmark.ts --manifest C:\private\tcgtracking-scan-fixtures.json --allow-upload --output C:\private\tcgtracking-scan-report.json
```

Schema recommendation:

- Do not apply the broad cache proposal yet.
- Existing `tcgplayer_magic_catalog` should remain the local exact-SKU authority.
- `tcgtracking_products` may duplicate existing catalog data if added wholesale. Prefer a smaller mapping table first.
- Minimum useful future schema:
  - `tcgtracking_product_mappings`: provider product id, TCGplayer Product ID, Scryfall ID, MTGJSON UUID, Cardmarket ID, CardTrader ID, set id, collector number, image URL, and confidence/audit metadata.
  - `tcgtracking_price_snapshots`: provider product id, TCGplayer SKU ID where available, condition, finish, language, market/low/high/listing/Manapool values, and captured timestamp.
  - `tcgtracking_sync_runs`: bounded sync checkpoints, provider latency, counts, freshness, and errors.
- Recommended indexes:
  - `(tcgplayer_product_id)`.
  - `(scryfall_id)`.
  - `(mtgjson_uuid)`.
  - `(provider_product_id, condition, finish, language, captured_at desc)`.
  - `(captured_at desc)`.
- Recommended sync frequency:
  - Product identity mappings: weekly or on-demand after new catalog imports.
  - SKU pricing snapshots: daily, with manual admin refresh for high-value cards.
  - Scanner candidates: live/on-demand only, benchmark gated.

## Phase 3 Expanded Evidence

Status: Partially Implemented

Validation date: 2026-08-11.

Machine-readable artifact:

- `artifacts/tcgtracking-reconciliation.json`

Live provider sample:

- Requested sample size: 51.
- Products sampled: 50.
- Sets covered: Commander Legends, Prophecy, Rise of the Eldrazi, Mirrodin, Commander Masters, Wilds of Eldraine: Enchanting Tales, Secret Lair Drop Series, Modern Horizons 3, and FINAL FANTASY.
- Evidence buckets covered: Commander, older-frame, artifact, borderless, showcase, foil, promo, alternate-treatment, and recent-set products.
- Provider category count: 62.

Local catalog reconciliation:

- Status: Requires Production Configuration.
- The harness joins against `tcgplayer_magic_catalog` when `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are available in the shell.
- This run did not have those variables configured, so no Supabase-backed local catalog rows were read and no exact local SKU match rate is claimed.
- The reconciliation code still validates exact SKU matching, condition/finish matching, conflict classification, and pricing delta calculations through unit coverage.

SKU and pricing checks:

- Provider SKUs include condition, finish, language, TCGplayer SKU ID, market price, low price, high price, active listing count, and Manapool low where available.
- The Trading Docks reconciliation model normalizes compact TCGTracking condition codes such as `NM`, `LP`, `MP`, `HP`, and `DMG` before comparing against local catalog conditions.
- Pricing deltas are reported as both absolute dollar deltas and relative percentage deltas. The 1% and 5% summary metrics are percent-based, not cent-based.
- Because the local Supabase join was unavailable in this shell, pricing delta summary values in the artifact are intentionally `null`.

Image reliability:

- Images tested: 50.
- Successful image responses: 49 of 50.
- Success rate: 98%.
- Median HEAD latency: 41 ms.
- 95th percentile HEAD latency: 62 ms.
- Exact-printing mismatches detected by this harness: 0.
- Keep TCGTracking images as a fallback source only; do not change the current Deck Vault or Collection image priority yet.

Scanner benchmark:

- Status: Requires Product-Owner Fixtures.
- No private image manifest was present in the repository or shell, so no scanner accuracy numbers are claimed.
- `scripts/tcgtracking/scan-benchmark.ts` now supports local-only private fixture manifests using relative filenames under a private fixture directory.
- The benchmark runner requires `--allow-upload`, because it sends private test images to TCGTracking.
- Reports intentionally export fixture identifiers, expected labels, candidates, latency, top-1/top-3 results, unresolved status, and incorrect-printing status. They do not export local image paths or image contents.

Private scanner fixture manifest example:

```json
{
  "fixtureSetId": "magic-private-benchmark-2026-08",
  "fixtures": [
    {
      "filename": "normal/arcane-signet.jpg",
      "expectedName": "Arcane Signet",
      "expectedSet": "Commander Legends",
      "expectedCollectorNumber": "297",
      "expectedProductId": 226694,
      "treatment": "normal"
    }
  ]
}
```

Local commands:

```bash
node --experimental-strip-types scripts/tcgtracking/live-validation.ts --sample-size 51 --output artifacts/tcgtracking-reconciliation.json
node --experimental-strip-types scripts/tcgtracking/scan-benchmark.ts --manifest .local-fixtures/tcgtracking-scan/manifest.json --allow-upload --output C:\private\tcgtracking-scan-report.json
```

Phase 4 readiness:

- Not ready to switch scanner, pricing, or catalog authority.
- Ready to run the Supabase-backed reconciliation in an environment with service-role read access to `tcgplayer_magic_catalog`.
- Ready to run the scanner benchmark when product-owner-supplied private images exist locally.
- Keep the future schema narrow: mappings, price snapshots, and sync runs are enough until evidence proves a full product mirror is necessary.

## Phase 4 Production-Safe Enrichment

Status: Partially Implemented

Validation date: 2026-08-11.

Phase 4 keeps TCGTracking as an enrichment provider. It does not replace:

- `tcgplayer_magic_catalog` as the exact Magic SKU authority.
- current scanner recognition authority.
- current pricing authority.
- user inventory authority.

### Local Catalog Reconciliation Command

Status: Requires Production Configuration

Run the bounded reconciliation from a trusted server environment that has:

- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- optional `TCGTRACKING_API_BASE_URL`
- optional `TCGTRACKING_API_KEY`

Command:

```bash
node --experimental-strip-types scripts/tcgtracking/live-validation.ts --sample-size 51 --output artifacts/tcgtracking-reconciliation.json
```

The report includes products tested, provider SKU rows tested, local SKU rows found, exact SKU matches, missing local SKUs, missing provider SKUs, condition/finish/language conflicts, and pricing deltas. The script never overwrites catalog rows.

### Proposed Smallest Schema

Status: Planned

Migration proposal:

- `supabase/migrations/202608110002_tcgtracking_enrichment_cache_proposal.sql`

Proposed SQL objects:

- `public.tcgtracking_product_mappings`
- `public.tcgtracking_price_snapshots`
- `public.tcgtracking_sync_runs`
- `public.set_tcgtracking_updated_at()`
- update triggers for mappings and sync runs
- indexes for TCGplayer Product ID, Scryfall ID, SKU ID, variant lookup, `observed_at`, freshness, and sync status

Schema safety review:

- Additive only.
- No `DROP TABLE`.
- No changes to `tcgplayer_magic_catalog`.
- No changes to `inventory_items` or user inventory ownership.
- Provider cache tables are global reference data, not tenant inventory.
- RLS is enabled and direct `anon`/`authenticated` table access is revoked.
- Server/service-role code remains the mutation authority.
- Pricing precision is `numeric(12,2)`.
- Price history is append-only in `tcgtracking_price_snapshots`; retention should be defined before high-frequency sync.

### Sync Architecture

Status: Partially Implemented

Server-side sync service:

- `src/lib/providers/tcgtracking/sync.ts`

Admin endpoint:

- `POST /api/admin/tcgtracking/sync`

Supported actions:

- `validate_magic`
- `reconcile_sample`
- `sync_magic_mappings`
- `refresh_magic_pricing`

The sync service advances a bounded amount of work per request, persists progress in `tcgtracking_sync_runs`, and resumes from the checkpoint. The first production surface is admin-triggered from System & Integration Health. No cron is wired in this phase.

If the proposal migration has not been applied, sync returns `schema_required` instead of attempting writes.

### Admin Sync Surface

Status: Partially Implemented

The existing Owner/Admin System & Integration Health panel now includes TCGTracking actions and sync freshness fields:

- Validate Magic provider.
- Reconcile sample.
- Sync Magic mappings.
- Refresh Magic pricing.
- Last mapping sync status and processed count.
- Last pricing sync status and processed count.

The panel remains gated through platform Owner/Admin authority. Normal users do not receive provider diagnostics or mutation actions.

### Image Integration

Status: Partially Implemented

Shared image authority:

- `src/lib/card-image-authority.ts`

Current exact-image priority:

1. Trading Docks/local exact image.
2. Already known exact card image.
3. TCGTracking exact Product ID image.
4. Scryfall exact-printing fallback.
5. Unavailable state.

The Deck Vault image fallback route accepts an exact `tcgplayerProductId` and tries the TCGTracking product image before falling back to existing Scryfall exact-printing lookup. TCGTracking is not the only source.

### Inspector Market Enrichment

Status: Partially Implemented

Transparent market helpers are implemented through `marketSnapshotFromTcgTracking`, `spreadPercent`, `crossMarketSpread`, and `liquidityLabel`.

Liquidity thresholds:

- High: 50+ active listings.
- Medium: 12-49 active listings.
- Low: fewer than 12 active listings.
- Unknown: listing count missing.

The card inspector should display cached TCGTracking market data only when exact SKU identity exists and the price snapshot is fresh. Stale or missing values must not be presented as current.

### Scanner Benchmark Fixtures

Status: Partially Implemented

Local private fixture root:

- `.local-fixtures/tcgtracking-scan/`

Template manifest:

- `scripts/tcgtracking/scan-manifest.local.example.json`

Working local manifest path:

- `.local-fixtures/tcgtracking-scan/scan-manifest.local.json`

Run:

```bash
node --experimental-strip-types scripts/tcgtracking/scan-benchmark.ts --manifest .local-fixtures/tcgtracking-scan/scan-manifest.local.json --allow-upload --output C:\private\tcgtracking-scan-report.json
```

The fixture directory is gitignored. No copyrighted card images should be committed.
