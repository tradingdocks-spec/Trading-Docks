# Magic Scanner Calibration

## Current Status

- Implemented: Magic scanner calibration tooling lives in `mobile/services/magic-recognition-provider.ts`.
- Implemented: The local CLI command is `npm run benchmark:magic-scanner -- --manifest <private-manifest.json>`.
- Implemented: Benchmark output is generated as JSON, CSV, and Markdown under `mobile/benchmark-output/magic-scanner` by default.
- Implemented: `mobile/fixtures/private-scanner/`, `mobile/fixtures/magic-scanner-private/`, and `mobile/benchmark-output/` are ignored by Git.
- Partially Implemented: The runner benchmarks the current metadata-backed Magic adapter and optional observed signal sidecars. It does not perform OCR or image recognition from raw photos yet.
- Planned: Product-owner-supplied private fixtures are still required before any accuracy, latency, false high-confidence, or threshold-change claims can be made.

## Private Fixture Manifest

Create a private JSON file outside committed source, or under an ignored fixture directory:

```json
{
  "schemaVersion": 1,
  "fixtureSetId": "private-magic-fixtures-2026-08",
  "createdAt": "2026-08-05T00:00:00.000Z",
  "fixtures": [
    {
      "id": "modern-rhystic-study-wot-25",
      "localImagePath": "C:/private/magic/modern-rhystic-study-wot-25.jpg",
      "expectedCardName": "Rhystic Study",
      "expectedSetCode": "WOT",
      "expectedCollectorNumber": "25",
      "expectedScryfallId": "scryfall-id-here",
      "expectedLanguage": "en",
      "expectedFinish": "nonfoil",
      "frameType": "modern_frame",
      "lightingCondition": "controlled",
      "sleeveStatus": "unsleeved",
      "angle": "flat",
      "notes": "Private fixture. Do not commit image."
    }
  ]
}
```

Optional `observed` fields can be supplied when a reviewed OCR or human-labeling process has extracted signals:

```json
{
  "observed": {
    "nameText": "Rhystic Study",
    "nameConfidence": 91,
    "collectorInfoText": "WOT 25 EN",
    "finish": "nonfoil",
    "finishConfidence": 80,
    "artworkLayout": "normal",
    "artworkSimilarity": 0.82,
    "setSymbol": "WOT",
    "setSymbolConfidence": 76
  }
}
```

If `observed` is missing, the runner uses expected metadata as a calibration seed and labels the result `expected_metadata_seed`. That is useful for testing ranking and reporting, but it is not visual recognition evidence.

## Local Command

Run from `mobile/`:

```powershell
npm run benchmark:magic-scanner -- --manifest C:\private\magic\manifest.json
```

Optional output directory:

```powershell
npm run benchmark:magic-scanner -- --manifest C:\private\magic\manifest.json --output C:\private\magic\reports
```

The generated reports intentionally omit `localImagePath` and image filenames. Reports include sanitized fixture IDs, expected metadata, top-1/top-3 candidate ids, per-signal confidence, latency, threshold class, and calibration recommendations.

## Categories

- Implemented: `modern_frame`
- Implemented: `old_border`
- Implemented: `borderless`
- Implemented: `extended_art`
- Implemented: `showcase`
- Implemented: `retro_frame`
- Implemented: `double_faced`
- Implemented: `same_name_reprints`
- Implemented: `foil`
- Implemented: `etched_foil`
- Implemented: `sleeved_card`
- Implemented: `glare`
- Implemented: `low_light`
- Implemented: `angled_card`
- Implemented: `damaged_card`
- Implemented: `foreign_language`
- Implemented: `token`
- Implemented: `unsupported_card`

## Metrics

- Implemented: Card name top-1 accuracy.
- Implemented: Exact printing top-1 accuracy.
- Implemented: Exact printing top-3 accuracy.
- Implemented: False high-confidence rate.
- Implemented: Average confidence.
- Implemented: Average latency.
- Implemented: Manual correction rate.
- Implemented: Finish accuracy when a finish signal exists.
- Implemented: Unsupported-card rejection rate.

## Threshold Classes

- `auto_suggest`: strong agreement, no conflicts, single candidate, and confidence at least 96. Still requires confirmation in this sprint.
- `one_tap_confirm`: strong candidate suitable for streamlined confirmation after benchmark approval.
- `review_alternatives`: ambiguous or confirmation-gated results with usable candidates.
- `manual_search_required`: weak, missing, failed, or unsupported signals.

## Calibration Rules

- Implemented: The report proposes over-weighted signal, under-weighted signal, missing-evidence inflation, threshold, and weight recommendations.
- Implemented: Recommendations are advisory and set `applyAutomatically: false`.
- Planned: Do not change weights or thresholds until real private fixtures show repeatable evidence.
- Planned: Product owner must approve fixture mix, target thresholds, acceptable false high-confidence rate, and whether any result can become one-tap confirmation.

## Privacy

- Implemented: Source images are never exported to benchmark JSON, CSV, or Markdown.
- Implemented: Source image paths and filenames are not exported.
- Implemented: The benchmark runner does not upload images to Scryfall or any remote vision provider.
- Requires Production Configuration: If a future OCR/image provider uses native processing or remote processing, update this document and `docs/SECURITY.md` before enabling it.
