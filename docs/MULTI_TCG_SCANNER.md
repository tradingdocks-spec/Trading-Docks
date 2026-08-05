# Multi-TCG Scanner

## Current Status

- Implemented: Multi-TCG scanner contracts live in `mobile/services/multi-tcg-scanner.ts`.
- Implemented: Supported game ids are `magic`, `pokemon`, `one_piece`, `lorcana`, and `unknown`.
- Implemented: A game-detection stage ranks supported games before game-specific recognition.
- Implemented: Detection output is explainable: detected game, confidence, per-signal scores, conflicts, and alternatives from ranked candidates.
- Implemented: Replaceable adapter contracts exist for Magic, Pokemon, One Piece, and Lorcana.
- Implemented: Magic now uses `MagicRecognitionAdapter` from `mobile/services/magic-recognition-provider.ts` as the routed reference implementation instead of the prior stub.
- Implemented: Mixed scan sessions track candidates, unsupported observations, pending sync count, failed items, combined export mode, and game-separated export mode.
- Implemented: Unsupported cards can be preserved as `UnsupportedCardObservation`; they are not forced into the nearest supported game.
- Partially Implemented: Magic has Scryfall-backed candidate resolution and explainable ranking, but still depends on supplied OCR/artwork/layout/finish observations and private benchmark fixtures before any production visual-accuracy claim.
- Partially Implemented: Pokemon, One Piece, and Lorcana adapters are architecture stubs. They define region maps, finish taxonomies, provider ids, and routing, but they do not run production OCR, artwork matching, or game catalog lookup.
- Partially Implemented: The active mobile scanner UI still writes Magic-compatible Collection records through the existing exact-printing confirmation flow.

## Shared Pipeline

- Implemented: Camera capture, scanner replay, sessions, destination contracts, confidence concepts, and exports remain shared across games.
- Implemented: Game-specific adapter boundaries own region maps, card identifiers, candidate catalog lookup, metadata validation, finish taxonomy, and signal weights.
- Implemented: Manual game correction updates the candidate, card identity, printing identity, and game-confidence record.
- Planned: The confirmation UI should expose the detected game badge on every result and allow manual game correction before writing inventory.

## Game-Specific Fields

- Magic: Implemented contract fields include name, set code, collector number, Scryfall id, mana/color metadata, set symbol, layout, language, legal finishes, and finish compatibility. Missing exact-printing signals require confirmation and do not inflate confidence.
- Pokemon: Implemented contract fields include name, set/expansion, card number, external card id, HP, stage/type, regulation mark, rarity, illustrator, language, and finish category.
- One Piece: Implemented contract fields include name, card id such as `OP01-054`, set/product, card type, color, cost, power, counter, rarity, block icon, language, and finish/parallel state.
- Lorcana: Implemented contract fields include name, subtitle, set, collector number, ink color, cost, inkability, strength, willpower, lore, rarity, language, and finish.

## Catalog Providers

- Implemented: `TcgCatalogProvider` separates external provider id, catalog version, refresh timestamp, license status, and lookup contract.
- Implemented: External provider ids stay separate from Trading Docks inventory ids.
- Implemented: Magic catalog lookup uses Scryfall text metadata search for paper printings and keeps provider identifiers separate from inventory identity.
- Requires Production Configuration: Pokemon, One Piece, and Lorcana catalog providers need licensing/API review before mobile lookup can ship.
- Planned: The mobile app must not scrape publisher pages directly. Catalogs should be served through reviewed provider APIs or cached Trading Docks services.
- Planned: Missing catalog data must show unavailable/requires-review states, never fabricated card or price data.

## Privacy

- Implemented: Multi-game architecture inherits scanner frame defaults: no image upload and no image retention by default.
- Implemented: Unsupported observations store detection signals, not captured images.
- Planned: Remote image processing for any game requires explicit user consent, HTTPS-only provider communication, and sanitized telemetry.

## Remaining Work

- Planned: Add real game-detection provider implementation.
- Planned: Add game-specific catalog integrations after licensing review.
- Planned: Add confirmation UI for game badges, manual game correction, and unsupported-card review.
- Planned: Add per-game benchmark fixtures before publishing accuracy claims.
