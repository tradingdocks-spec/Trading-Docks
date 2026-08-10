# Magic Scanner Calibration

## Current Status

- Implemented: Magic scanner calibration tooling lives in `mobile/services/magic-recognition-provider.ts`.
- Implemented: The local CLI command is `npm run benchmark:magic-scanner -- --manifest <private-manifest.json>`.
- Implemented: Benchmark output is generated as JSON, CSV, and Markdown under `mobile/benchmark-output/magic-scanner` by default.
- Implemented: `mobile/fixtures/private-scanner/`, `mobile/fixtures/magic-scanner-private/`, and `mobile/benchmark-output/` are ignored by Git.
- Implemented: The development-only builder route exists at `/dev/scanner-benchmark` and requires `EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER=true`.
- Partially Implemented: The runner benchmarks the current metadata-backed Magic adapter and optional observed signal sidecars. It does not perform OCR or image recognition from raw photos yet.
- Partially Implemented: The benchmark builder creates local fixture manifests and captures labels, but it does not run OCR or determine ground truth from the captured image.
- Planned: Product-owner-supplied private fixtures are still required before any accuracy, latency, false high-confidence, or threshold-change claims can be made.

## Benchmark Builder

Enable only in development:

```powershell
EXPO_PUBLIC_ENABLE_SCANNER_BENCHMARK_BUILDER=true
```

Then open `/dev/scanner-benchmark` in the Expo app. The route is not linked from normal navigation and shows an unavailable state unless the flag is set.

Implemented workflow:

1. Create or resume a local dataset.
2. Acknowledge the privacy warning.
3. Search Scryfall and explicitly select the expected Magic printing.
4. Capture a local image with the existing Expo Camera preview and boundary guide.
5. Review or retake the image.
6. Label finish, frame/category, sleeve, lighting, angle, card face, condition, and notes.
7. Save a fixture entry with a stable id and relative local fixture path.
8. Review dataset progress and counts by category.
9. Validate the manifest.
10. Run the benchmark where supported, or display the desktop command on native.

Dataset management supports create, resume, validate, edit first fixture metadata, retake first fixture image, remove first fixture, delete dataset with typed confirmation, and interrupted-manifest recovery through backup JSON in the service layer. Future UX can expose richer per-fixture editing once the initial workflow is reviewed.

Local directory structure:

```text
mobile/fixtures/magic-scanner-private/<dataset-id>/images/<fixture-id>.jpg
mobile/fixtures/magic-scanner-private/<dataset-id>/manifest.json
mobile/benchmark-output/magic-scanner/<dataset-id>-<timestamp>.json
mobile/benchmark-output/magic-scanner/<dataset-id>-<timestamp>.csv
mobile/benchmark-output/magic-scanner/<dataset-id>-<timestamp>.md
```

The builder uses relative manifest image paths under `mobile/fixtures/magic-scanner-private`. Absolute paths and traversal paths are rejected by validation.

## Private Fixture Manifest

Create a private JSON file outside committed source, or use the builder to create one under an ignored fixture directory:

```json
{
  "schemaVersion": 1,
  "fixtureSetId": "private-magic-fixtures-2026-08",
  "createdAt": "2026-08-05T00:00:00.000Z",
  "fixtures": [
    {
      "id": "modern-rhystic-study-wot-25",
      "localImagePath": "mobile/fixtures/magic-scanner-private/private-magic-fixtures-2026-08/images/modern-rhystic-study-wot-25.jpg",
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

Native limitation: iOS and Android cannot spawn the Node benchmark runner from the app. The builder still generates the dataset and shows the exact desktop command to run. Expo Web and desktop environments can run the benchmark helper when local filesystem access is available.

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
- Implemented: The builder does not save benchmark images to the normal photo library by default and does not record production analytics.
- Requires Production Configuration: If a future OCR/image provider uses native processing or remote processing, update this document and `docs/SECURITY.md` before enabling it.

## Starter Dataset

Recommended first private dataset before calibration decisions:

- 5 modern frame, controlled lighting, unsleeved.
- 5 old border or retro frame.
- 5 borderless, extended art, or showcase.
- 5 same-name reprints across multiple sets.
- 5 double-faced cards.
- 5 foil cards plus 5 nonfoil glare controls.
- 5 sleeved cards.
- 5 low-light or angled cards.
- 3 damaged cards.
- 3 foreign-language cards.
- 3 token or unsupported fixtures.
