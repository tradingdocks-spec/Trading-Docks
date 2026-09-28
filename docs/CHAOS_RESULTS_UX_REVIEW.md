# Chaos Sort results and review UX

Status: Implemented on `codex/chaos-results-ux`; pending owner review. Do not merge or deploy as part of this task.

## Scope

Presentation polish following successful owner-assisted Ricoh recognition. Recognition provider, identification algorithm, auto-confirm rules, intake/command identity, removal protection, capacity, inventory commit and RLS remain unchanged. No migration or dependency change is required. Production was inspected read-only; no recognition calls, retries, removals or inventory commits were made.

## Before and after

| Before | After |
| --- | --- |
| READY + CONFIRMED + BULK_CU badges | One Ready to add badge for an accepted exact printing |
| Confirm on an already-confirmed card | Change Match; Confirm appears in the inspector only when confirmation is needed |
| Bulk confirm even when everything is confirmed | Offered only for visible unconfirmed high-confidence matches |
| TLA · 238 · unknown | Avatar: The Last Airbender · TLA · #238; Finish not determined · English |
| Conf 99% / Owned 0 | 99% match · 0 owned |
| Ambiguous proposed match | Review needed, available reason, Review Match / Mark unknown / Remove |
| Line-item counters and overlapping machine states | Cards scanned; ready to add / need review; nonzero unknown, failed and processing counts |
| Select all ready / Select exceptions | Select ready / Select needs review; selection follows displayed states |
| Processing N cards after work has finished | Scans saved in the batch |
| Raw recognition enum / Canonical plan | Readable status / Sorting pile |

Ready to add is derived from the existing `liveScanStatus`/commit-eligibility presentation. High machine confidence alone does not make an unconfirmed card ready. A manually accepted review result can be ready even if its machine confidence remains lower. Internal states are not rewritten to obtain these labels. Unknown, failed and processing remain distinct; removal and retry controls remain available.

The result row keeps a bounded thumbnail beside the identity on mobile, wraps metadata and actions, and gives one status badge and the available price priority over secondary confidence/ownership text. Existing exact-printing search, manual fields, rotation, retry and sorting controls remain in the inspector. Change Match opens that existing workflow. Selecting a printing retains its metadata and replaces/clears the previous printing's price reference; missing amounts are never fabricated.

## What Bulk C/U means

`bulk_cu` is the physical sort pile for bulk commons and uncommons. The default rule selects common/uncommon cards with market values at most $0.99. The existing fallback also routes otherwise-unclassified low-value cards there (and treats missing price as zero for that fallback). It is not a recognition/confirmation state or evidence that a price was resolved.

The result row no longer shows this internal classification. Sorting mode, batch summary, inspector and rule controls show **Bulk commons & uncommons**. Rule IDs, priorities, conditions, persisted labels and classification behavior are preserved; labels are translated at display time. No sorting/pricing semantics were repaired or changed as part of this task.

## Production pricing and metadata finding

Read-only inspection of the currently successful captures on 2026-09-28 UTC found:

| Card | Printing | Stored confidence | Stored price | Reference |
| --- | --- | --- | --- | --- |
| Professor Zei, Anthropologist | TLA #238 | 99% | $0.23 USD | Scryfall nonfoil |
| Flopsie, Bumi's Buddy | TLA #179 | 99% | $0.27 USD | Scryfall nonfoil |
| Sokka's Haiku | TLA #71 | 99% | $0.20 USD | Scryfall nonfoil |

All three had confirmed human state, `language=en`, `finish=unknown`, and the full set name **Avatar: The Last Airbender** in their saved exact-printing candidates. Their prices were already resolved and stored; the main row simply did not render them. The existing pipeline chooses the first available numeric reference. These values are not a live TCGplayer market quote or proof of the physical card's finish.

The UI therefore renders **Nonfoil reference $0.23 · Scryfall** alongside **Finish not determined**, rather than inventing Nonfoil as a recognized finish. Absent price is omitted, including legitimate missing prices. Zero is retained as a real numeric value. Candidate metadata is used only when its printing ID/name/set/collector number match the selected item, avoiding stale set names after manual edits. The manual-search `market` and recognition `value/available` formats are adapted without new network calls.

## Files

- `src/components/dashboard/inventory/ChaosSortWorkspace.tsx`: results, summary, selection, inspector and sorting labels; conditional confirmation actions; selected printing metadata.
- `src/components/dashboard/inventory/LiveScanStation.tsx`: same readable printing/status language in the scanner result/queue.
- `src/lib/chaos-sort/results-presentation.ts`: shared display-only status/metadata/price helpers.
- `src/lib/chaos-sort/domain.ts`: optional saved candidate metadata typings; no schema change.
- `tests/chaos-upload/results.spec.ts`: ready/review, metadata, missing values, correction, selection, mobile removal, screenshots.
- `tests/chaos-results-presentation.test.ts`: eligibility mapping, stale metadata rejection, honest price provenance, missing/zero prices.
- `tests/chaos-upload-preview.mjs`, `tests/chaos-live-preview.mjs`: include the shared helper in isolated fixtures.
- This report.

## Validation

- Pre-change root check: PASS, 1,029 tests, TypeScript/lint, production dependency audit 0 vulnerabilities.
- Final root check: PASS, 1,034 tests, TypeScript, lint (existing warnings only), and production dependency audit (0 vulnerabilities).
- Production build: PASS.
- Upload/results/retry browser suite: PASS, 15 tests. Final focused presentation/correction rerun: PASS, 3 tests.
- Native PostgreSQL/API/scanner browser suite: PASS, 8 tests, including 100-card capacity, lost-response recovery, stored identity retry, tombstones, mode/destination persistence and inventory commit replay.
- Native DB contract/RLS/capacity suite: PASS, 52 assertions, including workspace isolation and the 5-unit/two-position invariant.
- Diff check: PASS.
- Expo/mobile application: unchanged; Expo builds not run. Responsive web tested at 390px and 1440px.

Automated recognition is mocked/local; no paid OpenAI requests were used. Browser screenshots use synthetic thumbnail placeholders and mock recognition metadata; they are not new production Ricoh acceptance evidence. The scanner browser suite intentionally logs a connection reset while testing lost-response recovery. One suite launch encountered the previous fixture still holding port 4321; it was started successfully after that suite finished, without killing unrelated processes.

## Acceptance boundary

No production release is authorized. Owner-reported real Ricoh recognition success is preserved as production evidence; the 100-card real-world test remains pending. Review the UI and screenshots before deciding whether to merge. No production capture was modified for this work.

## Screenshot artifacts

Saved outside Git under `%LOCALAPPDATA%/TradingDocks/chaos-results-ux-20260928/`:
- `desktop.png`: ready and review result cards.
- `mobile.png`: ready card at a 390px viewport.

Both are browser screenshots of the isolated fixture with synthetic image placeholders.
