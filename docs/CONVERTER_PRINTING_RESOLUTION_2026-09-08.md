# Converter printing resolution

Status: **Partially Implemented** — implementation and automated regressions pass; acceptance against the user's original file and private SKU catalog remains pending.

## Implemented

- External seller SKU IDs, TCGplayer product IDs, and Scryfall printing IDs precede textual matching. Product IDs remain separate from the condition/finish-specific seller SKU ID used in exports.
- Direct and translated set/name/collector matches precede the special printing bridge. Magic collector comparison supports zero padding and printed set-size suffixes without mutating the input.
- PLST compound identifiers retain their complete source value. The special resolver validates the embedded original printing through Scryfall, follows the **List printing's** TCGplayer product link, and obtains the catalog set/name/number from TCGCSV. It never exports the original set's product as a substitute for a List reprint.
- Candidate resolution groups canonical set/name/number/product identities after applying finish and condition. Duplicate rows for the same identity select the lowest catalog SKU ID deterministically. Different known product IDs remain ambiguous. The existing catalog does not store a separate language or product-ID column; product links can be recovered from trusted TCGplayer photo URLs. No schema changes were made.
- Name/set and name-only resolution retain supplied printing constraints. A contradictory collector or unknown supplied set is not discarded merely to obtain a name-only match.
- `PLST_COMPOUND_COLLECTOR_UNRESOLVED` includes `sourceSetCode`, `sourceCollectorNumber`, the complete imported `collectorNumber`, and a metadata lookup error when applicable. Review UI shows the reason code and parsed source parts.
- The converter stores catalog printing fields separately and applies them only to TCGplayer export. Source/import and other export formats retain the compound collector number.

## Verification

`tests/fixtures/converter-review-regressions.csv` contains the five reported inputs. `converter-printing-families.json` contains public Scryfall/TCGCSV metadata captured on September 8, 2026. Test SKU records are synthetic and explicitly labeled; they are not represented as a copy of the private catalog.

| Input | Catalog product | Catalog set | Catalog number |
| --- | --- | --- | --- |
| Darkblast, plst, GK1-51 | 203631 | The List Reprints | 51 |
| Aerial Responder, plst, E01-2 | 581243 | The List Reprints | 002/106 |
| Knight of Meadowgrain, plst, DDG-5 | 582404 | The List Reprints | 5 |
| Belfry Spirit, plst, GK2-29 | 222432 | The List Reprints | 029/133 |
| Azorius Herald, gk2, 2 | 184794 | Ravnica Allegiance: Guild Kits | 2 |

The live public metadata bridge was replayed for all five inputs and returned the identities above. Automated converter tests resolve all five against the fixture SKU catalog with zero unresolved/ambiguous rows. They also cover distinct-product ambiguity, source preservation, exporter fields, ID precedence, normalized collector comparison, incorrect embedded original identity, and metadata outages.

Run converter tests:

```powershell
node --test --experimental-strip-types tests/csv-converter.test.ts tests/tcgplayer-catalog.test.ts
```

Run all repository tests with `npm test`; run TypeScript with `npm run typecheck`.

Final local validation: 47/47 converter/catalog tests and 598/598 repository tests passed. TypeScript passed. ESLint on changed files reported zero errors and one existing unused-parameter warning in the catalog tests.

## Pending acceptance

The exact user file was not present among repository samples, and its local path has been requested. No converter browser tab was available. Local Supabase configuration has no service-role credential, and the public role cannot read `tcgplayer_magic_catalog`. Final acceptance requires replaying the original file against the actual catalog and verifying the four List rows resolve and Azorius Herald selects the correct SKU. In particular, the actual cause of its duplicate private catalog rows cannot yet be inspected. Do not interpret synthetic SKU test success as completion of this gate.
