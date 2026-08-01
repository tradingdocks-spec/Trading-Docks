# Marketplace Catalog Enrichment v174

## What changed

- Added a marketplace-neutral title enrichment engine for eBay, TCGplayer, Shopify, and future connectors.
- Added safe Magic: The Gathering title parsing and Scryfall lookup.
- Added cached confidence, printing, catalog ID, and thumbnail metadata to existing listing snapshots.
- Added a **Find card images** action to the eBay reconciliation center.
- Added eBay photo → Scryfall thumbnail → placeholder fallback behavior.
- Added lazy-loaded 48 px thumbnails and capped enrichment batches to control bandwidth and API usage.
- Excluded lots, bulk, decks, sealed products, and multi-card listings from potentially misleading single-card images.

## Matching policy

- A title-derived result is never silently treated as an inventory match.
- Name plus set code or collector number receives exact catalog confidence but remains a reviewable suggestion until the user confirms the inventory mapping.
- Name-only results are clearly marked as suggested printings.
- Results are cached and are not fetched again on normal page loads.

## Deployment

No Supabase migration is required. Deploy the source, open eBay Import & Reconciliation Center, and click **Find card images**. Up to 100 uncached listings are reviewed per run; repeat if the page reports remaining listings.
