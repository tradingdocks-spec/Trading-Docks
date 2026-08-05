# Card Show Offer Scanner

## Current Status

- Implemented: Card Show Purchase, Trade Evaluation, and Collection Purchase session modes are modeled as offer workspaces.
- Implemented: The mobile Scan tab can add confirmed manual-search results into a persistent running session rather than immediately finalizing purchase inventory.
- Implemented: Session lines include game, card name, set code, collector number, exact printing id, language, finish, condition, quantity, confidence, market price, price source, price timestamp, buying percentage, cash offer, trade value, destination, review status, and notes.
- Implemented: The Session Review route supports filters by game, review status, confidence, and missing price; edit quantity, price, and purchase percentage; bulk confirm; undo recent scan; remove; and explicit CSV preparation.
- Partially Implemented: Market prices are manual/unavailable in this sprint. No live pricing provider is activated.
- Partially Implemented: Native share sheet and email CSV are planned; this sprint only prepares explicit CSV content.

## Offer Rules

- Implemented: Default cash rate is 70%.
- Implemented: Default trade rate is 80%.
- Implemented: Offer configuration supports percentage rules by price range, game, and condition, optional minimum card value, and rounding.
- Implemented: Missing market price is represented as unavailable and excluded from totals. It is never treated as `$0.00`.
- Implemented: Running totals include cards scanned, cards recognized, cards needing review, market value, cash offer, trade value, missing-price item count, game totals, and finish totals.
- Implemented: Continuous scanner entries can consume live analyzer fingerprints and recognition reports when supplied by the native frame pipeline.
- Partially Implemented: The active UI still requires user confirmation and manual price entry; live auto-captured rows remain gated on native frame delivery, benchmarked recognition, and review-safe confidence thresholds.

## Destinations

- Implemented: Destination types are Collection, Binder, Trade Binder, Storage Location, Purchase Intake, Trade Evaluation, and Export Only.
- Implemented: Purchased-card modes keep items in the session until the user explicitly confirms a destination.
- Partially Implemented: Collection handoff reuses the existing scanner confirmation path for confirmed collection-compatible lines.
- Planned: User-created binder mutations and purchase intake persistence need a reviewed schema/API path before they become production writes.

## Export

- Implemented: Universal CSV rows include session name, session type, game, card name, set, collector number, external id, language, finish, condition, quantity, market price, price source, price timestamp, buying percentage, cash offer, trade value, storage location, binder, confidence, review status, and notes.
- Implemented: Export is an explicit action. The app does not send email automatically.
- Planned: Add native share sheet, email action, saved export history, one CSV per game UI, and future marketplace adapter contracts.

## Remaining Work

- Planned: Replace manual pricing with approved market data providers.
- Planned: Add physical-device QA for rapid show intake, including VisionCamera frame delivery, auto-capture timing, card-removal behavior, and repeated-card duplicate protection.
- Planned: Add durable server-side purchase/trade session persistence after data model review.
