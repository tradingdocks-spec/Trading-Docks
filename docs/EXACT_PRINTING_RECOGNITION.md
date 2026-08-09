# Exact Printing Recognition

## Current Status

- Implemented: Magic scanner crops a named `bottomLeftPrintingRegion` from the normalized card crop.
- Implemented: Bottom-left OCR evidence is parsed for set code, collector number, language, and The List clues.
- Implemented: The List consistency is validated against Scryfall candidate metadata. Visual/OCR evidence alone never authorizes a silent printing swap.
- Implemented: The unified scanner Review List exposes compact finish correction for supported Scryfall finishes only.
- Implemented: Review List exposes `View other printings` and updates the existing session row when a different printing is selected.
- Partially Implemented: The unified scanner can mark printing uncertainty as Needs Review while continuing to scan; bottom-left refinement is still metadata/OCR based and not benchmarked as a visual-recognition guarantee.
- Planned: Multi-frame foil/etched visual classification remains benchmark-gated.

## Bottom-Left Region

`bottomLeftPrintingRegion` is derived from the normalized full-card crop. It sits near the lower-left printed collector/set line with padding for modern, showcase, borderless, and special frames while avoiding the main artwork area.

The region is used for exact-printing refinement. It may provide collector number, set code, language, and The List or special printing text clues. Missing or noisy OCR does not block session insertion.

## The List Detection

The scanner parses bottom-left OCR for clues such as `PLST` or readable `The List` text. That evidence is compared to Scryfall metadata: set code, set name, promo types, and derived special labels.

If evidence and metadata agree, exact-printing confidence may improve. If they conflict, the session row is marked for review. The scanner does not infer The List solely from visual appearance.

## Finish Handling

Finish controls show only Scryfall-supported visible finishes:

- Nonfoil maps to `prices.usd`.
- Foil maps to `prices.usd_foil`.
- Etched maps to `prices.usd_etched`.

Missing price fields remain unavailable. The scanner never substitutes zero or another finish price.

## Other Printings

`View other printings` loads Scryfall printings by oracle id when available, otherwise by exact card name. Results are cached in memory during the app session.

Selecting another printing updates the existing row rather than adding a duplicate row. If the previous finish is unsupported, the app selects a valid default and briefly explains the fallback.

## Unified Scanner Review

The scanner treats a reliable card-name match as identity success. If exact printing is uncertain, the row remains reviewable and is annotated with `Confirm printing`.

The scanner should show `Couldn't identify` only when card identity fails, not when the identity is known but printing needs review.

## Remaining Limitations

- Requires Production Configuration: physical-device OCR QA is still required for bottom-left crop reliability.
- Partially Implemented: The List detection depends on OCR text plus Scryfall metadata, not benchmarked symbol recognition.
- Planned: visual set-symbol matching, artwork matching, and foil/etched classification should be calibrated with private fixtures before lowering confirmation requirements.
