# Multi-TCG Data Model

## Current Inventory Audit

- Partially Implemented: `inventory_items` is effectively Magic-compatible today. It has generic columns such as `card_name`, `quantity`, `location_id`, and `data`, but active scanner writes populate Magic-oriented fields such as `scryfall_id`, `set_code`, and `collector_number`.
- Partially Implemented: `CollectionCard.game` exists as an optional application field and defaults to `Magic: The Gathering` when missing.
- Partially Implemented: Existing Magic records can remain valid because Scryfall identifiers and exact printing data are preserved.
- Planned: Do not destructively convert existing Magic inventory rows.

## Universal Inventory Contract

- Implemented: `universalInventoryContract()` separates game, card identity, printing identity, ownership, finish, language, storage, and pricing.
- Implemented: `TcgCardIdentity` stores game, name, optional subtitle, external provider, and external id.
- Implemented: `TcgPrintingIdentity` stores game, set, card number, language, finish, external provider/id, and game-specific metadata.
- Implemented: `UniversalScanCandidate` keeps game confidence separate from card-recognition confidence.
- Implemented: `UniversalScanExportRow` supports universal Trading Docks CSV columns across games.

## Schema Gaps

- Planned Migration Proposal Only: Add first-class `game`, `external_provider`, `external_id`, `printing_identity`, and `card_identity` fields or an equivalent normalized card-identity table.
- Planned Migration Proposal Only: Add persisted mixed scan sessions and saved scanner export records.
- Planned Migration Proposal Only: Add provider catalog version and refresh timestamp tracking for inventory rows sourced from non-Magic catalogs.
- Planned Migration Proposal Only: Add first-class general binder assignment if user-created binders become a scanner destination.

## Compatibility Rules

- Existing Magic inventory should adapt into the universal contract with `game = magic`, `externalProvider = scryfall`, `externalId = scryfall_id`, `setCode = set_code`, and `cardNumber = collector_number`.
- Pokemon, One Piece, and Lorcana rows should not be written through Magic-only columns as if they were Scryfall printings.
- Missing pricing remains unavailable. Do not store `$0` as a fake market price.
- Platform role, membership tier, and billing status do not imply catalog access or recognition accuracy.

## Provider Data Rules

- Requires Production Configuration: Each game catalog needs licensing, caching, API, update cadence, and attribution review.
- Planned: Catalog data should be versioned and refreshed through trusted provider services rather than mobile scraping.
- Planned: Provider ids are external identifiers and must not replace Trading Docks inventory item ids.
