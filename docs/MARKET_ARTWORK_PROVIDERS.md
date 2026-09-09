# Homepage Market Intelligence artwork

Status: **Implemented** and verified against the local production homepage on September 9, 2026. This change has not been deployed.

## Root cause and behavior

The previous homepage supplied Scryfall metadata only for Magic, explicitly marked non-Magic artwork unverified, and allowed an unverified card to become the featured card. Fallbacks therefore became the normal non-Magic experience. The artwork error state also persisted across URL changes.

The homepage now resolves 17 exact, verified printings from committed metadata: five Magic cards and three cards for each other game. All five tabs remain visible with real featured artwork and real thumbnails. No tab is hidden. Unknown identities return null images and cannot become featured. If a collection has no verified cards, it uses a compact collection-preview panel. A failed network image shows a fixed-size, neutral “Preview paused” safety state; changing to a working URL recovers rendering.

Prices and signals remain illustrative demo values. Artwork, language, set and collector identity are real. The refresh corrected several existing Magic set/collector labels to match their Scryfall IDs.

## Research and decisions

| Game | Selected provider and primary documentation | Exact demo identities |
| --- | --- | --- |
| Magic | [Scryfall card API](https://scryfall.com/docs/api/cards) | Existing five Scryfall IDs, with returned printing metadata |
| Pokémon EN | [Pokémon TCG API](https://docs.pokemontcg.io/api-reference/cards/get-card/) and its [maintained static dataset](https://github.com/PokemonTCG/pokemon-tcg-data) | sv8-238, sv3pt5-199, sv3pt5-205 |
| Pokémon JP | [TCGdex card API](https://tcgdex.dev/rest/card) and [documented asset sizes](https://tcgdex.dev/assets) | Japanese SV2a-025, SV2a-006, SV2a-151 |
| Lorcana | [Lorcast API](https://lorcast.com/docs/api), [cards](https://lorcast.com/docs/api/cards), [images](https://lorcast.com/docs/api/images) | The First Chapter 42, 23, 115; exact returned UUIDs |
| One Piece | [OPTCG API](https://www.optcgapi.com/documentation) | Exact standard card_image_id values OP01-003, OP01-025, OP01-016 |

[TCGGraph](https://tcggraph.com/docs/rest) was also investigated for One Piece. OPTCG's public exact-card endpoint and returned image fields were sufficient, so no additional provider dependency was introduced. The English Pokémon live API returned HTTP 500 during research; the same project's static dataset and image host returned successful responses. The committed snapshot avoids that API availability dependency at page load.

Japanese Pokémon uses Japanese names, IDs and `/ja/` images, not English substitutes. Lorcast URLs retain the exact returned paths and query strings. TCGdex's `/high.webp` and `/low.webp` suffixes are its documented asset API. OPTCG alternative-art responses are disambiguated by exact `card_image_id`. Its publisher-provided “SAMPLE” watermark remains intact.

These are public card-reference providers. Provider and publisher attribution appears beneath each game's table, linked to its exact provider card record. Publisher artwork remains the publisher's property; provider availability and attribution do not transfer ownership or establish an independent commercial license. No watermark is removed and no artwork is republished as a local asset.

## Network and verification

The homepage performs no card search, scraping or provider API lookup. It consumes normalized fields from the committed manifest. The explicit refresh script fetches exact metadata, validates approved HTTPS hosts, rejects redirects, checks successful image content types, decodes dimensions, and records the URL, timestamp, dimensions and SHA-256 for each image. All 17 records and 31 distinct large/thumbnail images passed verification.

Refresh from the repository root:

```sh
node --experimental-strip-types scripts/verify-demo-market-artwork.mjs
```

New Next/Image hosts are exactly:

- `images.pokemontcg.io`
- `assets.tcgdex.net` (Japanese paths only)
- `cards.lorcast.io` (`/card/digital/**`)
- `optcgapi.com` (`/media/static/Card_Images/**`)

Existing Scryfall patterns remain. Non-Magic images use the same-origin Next image optimizer. Scryfall uses Next/Image's unoptimized browser delivery because its CDN rejected the optimizer's default server request with HTTP 400 while verified descriptive-user-agent and browser requests succeeded. The existing CSP already permits Scryfall images; CSP was not broadened. Full-card `object-contain` rendering and fixed aspect-ratio containers prevent stretching, cropping and image-error layout jumps.

## Files changed

- `src/components/landing/MarketSection.tsx`: normalized data, verified featured selection, responsive table, compact zero-artwork state and attribution.
- `src/components/landing/MarketCardArtwork.tsx`: reusable image rendering and URL-specific error recovery.
- `src/lib/card-artwork/providers/index.ts`: provider adapters, identity types and host/game validation.
- `src/lib/card-artwork/demo-market-artwork.ts`: normalized resolver, curated signals, guards and development diagnostics.
- `src/lib/card-artwork/verified-demo-artwork.ts`: generated exact-printing metadata and verification evidence.
- `scripts/verify-demo-market-artwork.mjs`: explicit metadata/image verification refresh.
- `next.config.ts`: four exact image hosts.
- `tests/market-artwork.test.ts`: all games, missing/empty images, unknown identities, Japanese language, invalid hosts and featured/layout guards.
- `tests/e2e/market-artwork.spec.ts` and `playwright.market.config.ts`: actual homepage rendering, all game/signal/viewport combinations, controlled network failure and recovery.
- `src/lib/platform/api-access.ts`: classify the existing employee-invitation endpoint as authenticated, with workspace-manager enforcement documented in its handler. This repairs two pre-existing full-suite failures without changing the handler.
- `tests/public-web-ui.test.ts`: align stale hero-copy assertions with the current homepage; retain structural design checks.
- This document records the provider and validation decisions.

## Validation

- `npm run typecheck`: passed.
- `npm run lint`: passed with 0 errors and 491 existing warnings.
- `npm test`: all 663 tests passed.
- `npm run build`: passed.
- `npx playwright test --config playwright.market.config.ts`: all six browser tests passed; 100 combinations of five games, four signal modes and widths 1728, 1440, 1024, 430 and 390.
- The controlled image-failure case checks the container before and after failure, absence of a broken image element, and successful artwork after switching games.

Manual visual inspection used the actual production homepage route `/#market`, including Magic at 1728px, Japanese Pokémon at 1440px, Lorcana at 1024px, One Piece at 430px and English Pokémon at 390px. All four signal modes were exercised. Featured artwork and thumbnails were visible, full-card proportions were preserved, mobile tabs wrapped, table columns adapted, and no horizontal page overflow appeared. Browser tests additionally checked every combination for successfully decoded images and `object-fit: contain`.

The existing development CSP blocks webpack's eval-based dev runtime, so visual QA used `next build` and `next start`, preserving production security headers. External provider images can still become unavailable later; the explicit refresh and safe error state cover that limitation. Production deployment itself was not performed.
