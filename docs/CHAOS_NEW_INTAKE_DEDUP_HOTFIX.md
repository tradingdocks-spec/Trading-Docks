# Chaos intake/recognition deduplication hotfix

Status: Implemented locally; pending hotfix review and deployment. No production mutation, recognition request, inventory commit, merge, migration, or deployment was performed during this investigation.

## Read-only production evidence (2026-09-28 UTC)

Trading Docks production: `bohddnajlnmknngzjsjk`.
Reviewed base: `89142351c6661e8ba2af5548e688c4154e2ff177` (`origin/main`, PR #141 merge).
Vercel production deployment: `dpl_DuxrUCgePpVD7C4b9VChdW59YjNm`, READY at that SHA.
Album: `d10c2d4f-0b7f-48f8-a84c-35906ca2eefd` (CS-000023).

| Source | Current capture (RECEIVED, revision 1) | Referenced historical capture (REMOVED, revision 2) |
| --- | --- | --- |
| Card0004.jpg | `4aa6f12b-0810-41bb-97b2-2ee936158dff` | `9e4ae3f6-2763-4672-9875-aea254c3c263` |
| Card0005.jpg | `2a977866-3ebd-455e-812e-ec77c971b82a` | `e5b512b6-10e3-47bb-9ac3-c7d7a50b1d29` |
| Card0006.jpg | `105332be-0321-4907-901e-5a8a97daf592` | `176ede2d-b8a2-4dc8-9330-f19dedef2ad6` |

Each current row has `humanState=unknown`, `processingState=ready`, `notes="Duplicate scan image."`, an image object reference, and `duplicateOfItemId` pointing to the removed original with the same hash. Another removed generation exists: Card0004 `800c41c6-6535-4e9c-905e-59c823ca1523`, Card0005 `982918fa-d3d0-4cd9-b062-056aaf861f1d`, Card0006 `6ff016ed-d352-49f0-ae11-dc5813b7113f`. None was modified.

The new captures were received around 03:47:55–03:47:59 UTC; review writes were logged around 03:48:15–03:48:18. Backend requests used the PR #141 deployment. The inspected 03:47–03:49 log window contains scan/review requests but no card-photo-scan request.

## Cause and limits of attribution

The exact application writer of the persisted message is `processFiles` in `ChaosSortWorkspace.tsx`: it compared the image hash against other items/queue entries, populated `duplicateOfItemId`, then wrote UNKNOWN/REVIEW with the message and returned before the provider request. `stageFiles` has a separate admission warning with additional retry instructions; that warning skips storage. The scan API/RPC persists review JSON but does not generate this message or enforce global hash uniqueness. Thus the production rows demonstrate a recognition-queue veto after intake, not an OpenAI duplicate response or database hash constraint.

**The exact browser build/state that wrote these particular markers is unconfirmed.** Both current main and the public production chunk `/_next/static/immutable/chunks/0eie6tmxcq7-y.js` already contain PR #141's `humanState !== "removed"` exclusions in staging and processing. The backend deployment ID does not identify an already-open browser's JavaScript version. No service worker registration was found in repository source. Stale browser code/state is a possible explanation, not an established cause. The native browser A/remove/B scenario also succeeds against this baseline behavior. We cannot honestly conclude the marker was written before PR #141's exclusions ran, or that current main's tombstone predicate itself is reproducibly broken.

The semantic defect removed here is the redundant recognition-time hash veto and duplicate annotation of already-admitted physical events. Intake admission and recognition are now separate responsibilities. This prevents this class of persisted marker regardless of unrelated captures' historical hashes; it does not substitute speculation for incident attribution.

## Scope before and after

| Mechanism | Before | After |
| --- | --- | --- |
| File admission | Exact original-file SHA-256 against non-removed items in the loaded batch and staged files; duplicate upload skipped before storage | Unchanged |
| Recognition | Repeated hash comparison against batch items/queue; upload could be short-circuited; live events still received duplicate annotations; same-capture retry exemption | Capture ID determines queue identity; no cross-capture image-hash veto or duplicate annotation |
| Event replay | Server capture ID/payload and scanner command IDs; browser whole-job guard | Unchanged server guards, plus browser filtering of repeated/already-present new capture IDs before capacity accounting |
| Removal | Immutable capture-ID tombstone and revision guards | Unchanged |
| Database hash use | Immutable image payload validation for an existing capture ID, not unique across captures | Unchanged |

This is batch-scoped exact-byte upload protection, not perceptual matching, not workspace-wide uniqueness, and not a permanent historical blacklist. Similar scans and identical card printings do not imply the same physical card. Distinct scanner capture events with identical bytes can coexist in one batch. The existing upload workflow intentionally blocks exact same bytes while active in that batch; a later batch or upload after removal is allowed. There is no new manual override for byte-identical uploads in the same active batch. A future deliberate-copy upload control would be a separate product decision, not a weakening of replay protection in this hotfix.

## Changes and database boundary

- `src/components/dashboard/inventory/ChaosSortWorkspace.tsx`: recognition queue uses capture identity, excludes repeated new IDs/removed IDs before capacity calculation, clears obsolete duplicate annotations, removes the cross-capture hash rejection. Existing upload admission, retry claims, removal guards, bounded provider workers, revision writes and capacity enforcement remain.
- `tests/scan-albums/upload-forward.spec.ts`: native PostgreSQL/API/browser A-remove-B-retry-remove-C lifecycle, exact stored-request replay, active same-byte upload rejection, separate physical scanner events with identical bytes.
- `tests/chaos-upload/retry.spec.ts`: three admitted captures carrying historical duplicate markers retry in place, preserving tombstones and capacity.
- This document.

No database migration, dependency, environment, credential, provider-algorithm, or API-contract changes are required.

## Validation

- Pre-change `npm run check`: PASS, 1,029 tests.
- Post-change `npm run check`: PASS, 1,029 tests; TypeScript and lint have no errors; existing lint warnings remain; production dependency audit reports 0 vulnerabilities.
- Production `npm run build`: PASS.
- `node tests/chaos-scan-images-forward-db.mjs`: PASS, 52 assertions on isolated native PostgreSQL 17.10, including authenticated/workspace isolation, stale/replayed reviews, immutable removals, full-capacity retry, a 12-request last-slot race, and 5 authoritative units across two positions remaining 5.
- `npm run test:pos:db`: PASS, 132 assertions each for text and enum ledgers; inventory/event/checkout preservation, mixed shifts, and large carts.
- `npx playwright test --config playwright.scan-albums.config.ts`: PASS, 8 tests using the real scan API and local SQL with synthetic surrounding schema and mocked recognition. This is not a production restore. The intentional lost-response test logs a connection reset as part of recovery coverage.
- `npx playwright test --config playwright.chaos-upload.config.ts`: PASS, 12 tests, including all three legacy markers recovering without new intake.
- Final TypeScript check: PASS. `git diff --check`: PASS.
- Regression sensitivity: the new identical-byte physical-event test fails against the unchanged main component because the second card receives a duplicate annotation, and passes with this hotfix. This does not reproduce the disputed tombstone predicate on main.
- Expo Web/Native: not run; mobile is unchanged.

An initial lifecycle run removed the card before the cloud-save indicator had settled and timed out waiting for that indicator after removal. The test now waits for the preceding recognition save to settle before starting removal. No production workaround or additional runtime change was made for that test timing issue.

### Requested regression mapping

1. A creates one capture: native upload browser.
2. Same intake event replay creates no second card: native API replay twice, DB reservation replay.
3. Active same-hash new upload is blocked: upload and native browser tests, before another storage row.
4–8. Remove A, admit/recognize B, leave A removed, remove B, admit/recognize C: native browser, persisted after refresh.
9. Retry B keeps its ID and capacity: native browser plus existing retry tests; retry after B is removed remains forbidden.
10. Distinct legitimate physical copies coexist with identical bytes: two signed mock-scanner events through the real API/SQL; distinct IDs, two provider calls, no duplicate annotation.
11. Command/request replay remains idempotent: native API/SQL and scanner lost-response recovery.
12. Capacity remains correct: native full-capacity removal/replacement/retry and database race coverage.

Existing provider-failure/recovery, overlapping retry, removal-during-retry, and retry-at-100 browser tests remain in the suite. All provider requests in automated tests are mocked/local; no OpenAI credit is spent.

## Current production captures and owner acceptance

All three current IDs above are RECEIVED, not tombstoned, and have stored image references. The ordinary Retry recognition path can reuse their IDs and stored images, reset their review results, and proceed to the configured provider without re-upload or new capacity. Local tests verify that behavior with historical markers; successful live OpenAI identification remains unverified until an authorized post-deployment owner test. Production image bytes were not downloaded for this investigation.

After review and a separately authorized deployment, the owner should fully reload the production page, select each of these active captures, and use Retry recognition. Expect three active physical cards throughout, historical IDs still REMOVED, no extra uploads/cards, and provider results for review. Do not commit inventory as part of that acceptance. Physical Ricoh operation and real recognition accuracy are not proven by these synthetic tests.

Stop at hotfix review. No merge or deployment is authorized by this task.
