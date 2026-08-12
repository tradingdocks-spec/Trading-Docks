# Multi-TCG Platform Architecture

## Status

- Implemented: Magic: The Gathering remains the production game.
- Partially Implemented: Pokemon is registered as the first beta/proof-of-concept game through TCGTracking category `3`.
- Partially Implemented: The shared identity adapters in `src/lib/multi-tcg` define game-aware product, set, SKU, sealed, market, inventory, and search contracts.
- Partially Implemented: Collection and Portfolio adapters can render mixed Magic/Pokemon and card/sealed records from persisted inventory data.
- Partially Implemented: Production Pokemon catalog import, valuation, and broad scanner rollout remain future work; scanner add payloads now preserve Pokemon game/product/SKU identity when a confirmed provider candidate is explicitly saved.
- Requires Production Configuration: Any additional game requires provider licensing, cache cadence, attribution, and QA approval before production exposure.

## Current Magic-Specific Assumption Audit

### A. Magic-Only

- Implemented: Deck Vault, Commander, precon, mana-value, color identity, and Scryfall-specific flows are Magic-only.
- Implemented: ManaPool low pricing is Magic-only market intelligence.
- Implemented: Scanner prompts and OCR/recognition copy that reference exact Magic printings remain Magic-only unless routed through the TCGTracking game context.
- Implemented: `tcgplayer_magic_catalog` remains the exact Magic SKU authority.

### B. Generic Logic With Magic Naming

- Partially Implemented: `inventory_items.card_name`, `set_code`, `collector_number`, and `data.finish` describe card ownership today but are Magic-shaped names.
- Partially Implemented: Collection, Storage, Trade Binder, Wishlist, Label Studio, and CSV conversion can use the same ownership rows with explicit game identity; production Pokemon import/export workflows remain beta.
- Implemented: `finish` remains the Magic-compatible UI field, while `variant` is the generic per-game SKU label for games such as Pokemon.

### C. Shared Inventory And Collection Logic

- Implemented: `inventory_items.user_id`, `id`, `quantity`, `location_id`, `inventory_value`, `sku`, and `data` are reusable ownership concepts.
- Implemented: `inventory_locations` is game-neutral.
- Implemented: Trade Binder, Wishlist, storage assignment, and label identity should remain one shared inventory system, not one table per game.
- Partially Implemented: First-class `game_id`, `product_type`, provider product/SKU IDs, `variant`, and `language` are proposed for `inventory_items`; active scanner and adapter tests now preserve those values through confirmed saves.

### D. Marketplace Integration Logic

- Implemented: TCGplayer Magic catalog import and CSV conversion are Magic-specific and should not be broadened by renaming the table.
- Partially Implemented: The historical `tcg_categories`, `tcg_groups`, `tcg_products`, and `tcg_current_prices` tables are generic provider-cache shapes.
- Partially Implemented: TCGTracking enrichment proposals are category-aware and should remain provider cache/enrichment, not user inventory authority.

## Supported Games Registry

- Implemented: `src/lib/multi-tcg/registry.ts` is the central supported-game registry.
- Implemented: Magic: The Gathering uses TCGTracking category `1`, scanner game id `1`, and status `production`.
- Implemented: Pokemon uses TCGTracking category `3`, scanner game id `3`, and status `beta`.
- Planned: Yu-Gi-Oh!, Flesh and Blood, and Digimon are documented as planned placeholders only.
- Planned: Do not add one sidebar section per game. Collection, Market, Scanner, Inventory, and Search should use game filters.

## Core Identity Model

- Implemented: `GameIdentity` separates internal game id, display name, TCGTracking category id, scanner game id, status, aliases, and game capabilities.
- Implemented: `CatalogSet` represents game-aware sets/groups.
- Implemented: `CatalogProduct` represents `card` or `sealed` product identity.
- Implemented: `CatalogSku` represents exact condition, variant, language, provider SKU, TCGplayer SKU, and market snapshot.
- Implemented: `ProductType` is `card | sealed`.
- Implemented: `InventoryGameIdentity` adapts existing inventory rows and distinguishes game, product type, provider ids, exact SKU ids, variant, and language.

## Magic Compatibility Rules

- Implemented: Magic catalog rows adapt through `magicCatalogRowToGenericProduct()` without replacing `tcgplayer_magic_catalog`.
- Implemented: Existing Magic rows still infer `gameId = magic` when they have `scryfall_id`, `set_code`, or `collector_number`.
- Implemented: During transition, missing `game_id` is treated as Magic by active Collection/Portfolio adapters when the row is Magic-shaped; the migration proposal also deterministically backfills only Magic-shaped rows.
- Implemented: Scryfall, ManaPool, Commander, and Deck Vault capabilities are exposed only for Magic.
- Planned: Do not migrate Magic catalog data into a generic table until there is a verified, reversible cutover plan.

## Pokemon Proof Of Concept

- Partially Implemented: Pokemon is a beta supported game for TCGTracking provider proof, scanner game context, Collection rendering, products, sealed products, SKU variants, pricing, and images.
- Partially Implemented: Existing Collection adapters support Pokemon card rows with image, name, set, collector/product number, condition, variant, language, quantity, and market value without a separate Pokemon page.
- Partially Implemented: Existing Collection adapters support Pokemon sealed rows with `product_type = sealed`, quantity, image, and market value without routing through card finish controls.
- Partially Implemented: Pokemon examples should include booster boxes, Elite Trainer Boxes, packs, collection boxes, and tins through TCGTracking `/sealed`.
- Planned: Do not bulk import Pokemon into Trading Docks yet.
- Planned: Do not call Scryfall for Pokemon.
- Planned: Do not assume Magic Normal/Foil condition and finish labels apply to Pokemon. Use generic condition, variant, and language.

## Search And Scanner

- Implemented: The scanner request validator accepts Magic game id `1` and Pokemon game id `3`.
- Implemented: Unsupported scanner game ids are rejected instead of flowing through accidentally.
- Implemented: Game-aware search results include `[MTG]` and `[PKM]` labels plus the game display name.
- Partially Implemented: The mobile scanner has an explicit per-session Scan Game selector for Magic/Pokemon. It does not auto-detect game and still requires confirmation before inventory mutation.
- Planned: TCGTracking scan candidates remain confirmation-required; this sprint does not claim recognition accuracy for Pokemon.

## Market Intelligence

- Implemented: Shared market snapshots carry `tcgMarket`, `tcgLow`, `tcgHigh`, `activeListings`, freshness, spread, and liquidity.
- Implemented: Magic retains `manapoolLow` and cross-market spread.
- Implemented: Pokemon snapshots explicitly clear ManaPool-only fields.
- Planned: Game-specific market enrichments should be feature-gated by `GameIdentity.capabilities`.

## Existing Schema Reuse

- Reusable: `inventory_items.user_id`, `id`, `quantity`, `location_id`, `inventory_value`, `sku`, `data`, and timestamps.
- Reusable: `inventory_locations` and storage assignments.
- Reusable: `tcg_categories`, `tcg_groups`, `tcg_products`, and `tcg_current_prices` as generic provider-cache structures where still active.
- Reusable: TCGTracking proposal tables because they are keyed by `category_id`.
- Not reusable as generic authority: `tcgplayer_magic_catalog`; it remains Magic-only and should be adapted, not renamed.

## Minimum Migration Required

- Planned Migration Proposal Only: `supabase/migrations/202608120001_multi_tcg_inventory_identity_proposal.sql`.
- Adds: `inventory_items.game_id`, `product_type`, `provider_category_id`, `provider_product_id`, `provider_sku_id`, `tcgplayer_product_id`, `tcgplayer_sku_id`, `variant`, and `language`.
- Adds indexes for user-scoped game/product/SKU lookups, including exact provider SKU and exact TCGplayer SKU paths.
- Backfills existing sealed-shaped rows to `product_type = 'sealed'` before setting the default for future rows to `card`.
- Backfills only Magic-shaped card rows to `game_id = 'magic'` and provider category `1`; unknown/manual rows remain nullable for review rather than being silently classified.
- Does not alter RLS, delete data, replace tables, or apply Pokemon data.
- Safety Review: The proposal is additive and forward-only; constraints are added idempotently when absent, and existing user/workspace ownership policies remain authoritative.
- Staging Decision: Safe to apply to staging for validation after review.
- Production Decision: Safe to apply to production after a final database backup and staging replay. The migration is additive, does not create inventory rows, and preserves ambiguous legacy rows for review.
- Rollout rule: apply only after app code has been verified against staging and product-owner approval is given.

## Portfolio And Inventory Views

- Partially Implemented: Portfolio summaries group persisted inventory by game and product type where data is present.
- Partially Implemented: Collection summaries group by game and by singles/sealed product type.
- Partially Implemented: Collection filters support the conceptual `All`, `Magic`, and `Pokemon` model via `gameId`, plus `card` versus `sealed` via `productType`.
- Partially Implemented: Seller Inventory can tolerate unknown game rows through existing generic quantity/cost fields, but Pokemon selling/listing remains beta-hidden until marketplace export formats are approved.
- Implemented: Exact SKU matching keys include game, product type, provider/TCGplayer SKU identity, condition, variant, and language.

## Seller Inventory Readiness

- Implemented: The proposed identity contract can represent product, SKU, condition, variant, language, quantity, cost/price, and image using existing `inventory_items` plus additive identity columns.
- Partially Implemented: Active seller inventory screens remain Magic-first in presentation and should be adapted after the schema exists in staging.
- Blocker: Seller marketplace export should not write Pokemon or sealed SKUs until exact provider SKU resolution is validated against the target marketplace format.
- Blocker: Cost basis and sale price are already inventory/business concepts, but no multi-game import workflow should be enabled until provider product/SKU IDs are populated consistently.

## Backwards-Compatibility Risks

- Risk: Existing inventory rows without Magic-shaped fields can remain `game_id = null` after the proposal and should be shown as unknown/manual until reviewed.
- Risk: Magic-only export formats remain intentionally blocked for Pokemon and sealed inventory until exact marketplace format contracts are approved.
- Risk: TCGTracking provider availability, category names, set identifiers, and sealed endpoint behavior must be validated against live data before production use.
- Risk: The active scanner must not switch provider authority without benchmark evidence and confirmation UX.
- Risk: Marketplace exports must keep using exact TCGplayer SKU IDs; parent product IDs are insufficient.

## Live Provider Validation

- Implemented: `runMultiTcgProviderProof()` samples active supported games, categories, sets, cards, sealed products, SKUs, pricing, variants, languages, and image availability without writing database rows.
- Implemented: Live proof run on 2026-08-12 reached TCGTracking category `3` for Pokemon.
- Implemented: Pokemon sample set `24722` / `30C` / `ME: 30th Celebration` returned 19 cards, 48 sealed products, 143 SKUs, 41 price snapshots, `Holofoil` and `Normal` variants, English language, and available image URLs on sampled products.
- Implemented: Sample Pokemon cards included `Victini` (`013/128`, TCGplayer Product ID `696830`), `Greninja ex` (`021/128`, Product ID `696676`), and `Pikachu - 036/128` (Product ID `696680`).
- Implemented: Sample Pokemon sealed products included `30th Celebration 2-Pack Blister` (`704148`), `30th Celebration Battle Deck [Espeon ex]` (`704187`), and `30th Celebration Battle Deck [Umbreon ex]` (`704188`).
- Implemented: Magic category `1` was also reachable in the same proof run; Magic remains production and Pokemon remains beta.
- Planned: Product-owner approval is still required before enabling Pokemon inventory writes or scanner UI selection in production.

## Rollout Order

1. Implement shared registry and identity adapters.
2. Run live TCGTracking Pokemon proof against small samples.
3. Add staging-only game-aware inventory migration.
4. Add UI game filters in Collection, Market, Scanner, and Inventory.
5. Enable Pokemon search and scanner confirmation behind beta gating.
6. Add Pokemon inventory writes only after exact SKU matching and rollback tests pass.
7. Expand portfolio and seller analytics to group by game/product type.

## Final Compatibility Pass

- Implemented: The migration no longer uses a blanket `not null default 'card'` column addition that would classify every historical row as a card. Sealed-shaped rows are backfilled first, Magic-shaped card rows are then backfilled deterministically, and nullable unknown/manual rows are left for review.
- Implemented: Scanner confirmed-add payloads and offline queue keys include `game_id`, `product_type`, provider category/product/SKU ids, TCGplayer product/SKU ids, generic `variant`, and `language`.
- Implemented: Label Studio render data includes generic `inventory.game`, `inventory.product_type`, `inventory.variant`, and `inventory.language`; Pokemon labels do not receive Magic `finish` output.
- Implemented: The Magic TCGplayer resolver rejects non-Magic rows with `UNSUPPORTED_GAME` before querying `tcgplayer_magic_catalog`.
- Implemented: CSV conversion carries row-level `game` and `productType`, preserves the existing Magic flow, and blocks Pokemon or sealed rows from Magic-only export formats.
- Implemented: Purchase History lines preserve game/product/variant/language in line details without creating inventory rows.
- Implemented: Wishlist matching compares game and product type before name/set/condition/variant, preventing same-name cross-game matches.
- Production Gate: YES, the multi-TCG inventory migration is production-safe as an additive schema migration after backup and staging replay. Pokemon remains beta for catalog import, selling/export, and scanner recognition reliability; Magic remains the production authority.
