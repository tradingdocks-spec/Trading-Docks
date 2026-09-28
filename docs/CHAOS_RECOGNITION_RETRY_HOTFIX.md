# Chaos recognition retry hotfix

Status: Implemented on a focused hotfix branch; not merged or deployed.

## Root cause and production evidence

`ChaosSortWorkspace.processFiles` generates `Duplicate scan image.` before it calls the recognition endpoint. Both new intake and Retry Recognition use that queue. Its hash lookup excluded only the replacement item ID, included removed items, and also consulted hashes already seen in the queue. A different retained capture with the same hash could therefore veto recognition of an existing capture. A unique capture did already exclude itself; the defect is the broader application of intake deduplication to retries and tombstone history.

Read-only inspection on 2026-09-27 America/Phoenix found the original three quota-failed captures for Card0004.jpg, Card0005.jpg and Card0006.jpg marked REMOVED. Three newer RECEIVED captures have the same filenames and hashes, and their duplicateOfItemId values point at those removed originals. Their private front image objects are present. This is more precise than treating the old and current IDs as identical.

Preserve both sets. The three active captures can use Retry recognition after deployment without another upload. The original removed IDs must never be revived. No production records were edited and no paid recognition requests were made during this repair.

## Application-only correction

- New upload intake rejects hashes already present among active or staged items before storing a new capture. Renaming an identical file does not evade this check. Removed history does not block a deliberate new intake.
- Recognition retry of an existing capture with its associated hash bypasses the new-intake duplicate decision and clears the obsolete duplicate marker. The stored image, capture ID, physical-card count and capacity slot are reused.
- Retry resolves current state rather than trusting a stale selected item. A per-capture claim is acquired before fetching its image and released after completion/error; overlapping bulk and individual commands cannot start the same capture twice in a browser.
- Existing removal guards run again after image retrieval and reject late updates. The database remains the authority across browser sessions: identical review writes replay, conflicting stale revisions fail, and removed captures are immutable.

No migration, credential, provider, recognition algorithm, inventory/POS or dependency change is required. The existing forward-migration contract already provides the required revision, capacity and tombstone behavior.

## Regression coverage

The isolated browser recognition fixture covers new upload A, rejected same-byte new intake, provider failure and recovery, repeated retries retaining one capture, historical duplicate markers, overlapping bulk/single retry, removal during pending image retrieval, and retry with 100 existing captures. A full-capacity fixture deliberately contains same-hash existing captures to verify that retries do not reapply new-intake validation. Images in the ordinary multi-image fixture now have distinct bytes; previously the tests used identical bytes for different names.

The native PostgreSQL contract suite adds repeated/concurrent review updates at full capacity, stale-result rejection and unchanged inventory quantities. Existing tests verify RLS/workspace isolation, tombstone rejection, capacity races and commit invariants. The database-backed browser suite exercises provider recovery and retry of a newer capture beside its original tombstone through the real scan API/RPC with synthetic recognition.

Validation passed:

- Root `npm run check`: TypeScript, ESLint (no errors; existing warnings), 1,029 tests, production dependency audit (zero vulnerabilities).
- Production `npm run build`: passed, including generated routes and build type checking.
- Upload/retry browser suite: 11 passed.
- Native PostgreSQL scan-image/RLS/capacity/inventory contract: 52 assertions passed.
- Database-backed browser suite: five capacity/album/mode tests passed in the full run; both upload tests passed on the targeted rerun after waiting for cloud recovery before interacting with the hidden file input. This includes one-front removal/refresh, ten-front commit, provider recovery and the tombstone/retry reproduction.
- POS/inventory database suites: 132 checks passed with the text ledger and 132 with the enum ledger, including 500-line carts.
- Final changed-file lint, TypeScript and whitespace checks passed.

Tests use disposable loopback PostgreSQL and isolated app fixtures; no Docker or hosted database mutations are involved. Recognition responses are simulated, not paid OpenAI calls.

## Deployment and acceptance risk

The runtime change is confined to the Chaos workspace. New byte-identical uploads now show an explicit skipped-duplicate warning before storage. Intentional copies captured as distinct live-scanner captures retain their existing behavior. Separate browser sessions may still issue separate provider calls, but database identity/revision checks prevent extra captures or capacity increments.

After owner-approved merge/deployment, reload Chaos Sort and use Retry recognition on each existing active Ricoh capture (their previous duplicate failure is displayed as UNKNOWN/REVIEW rather than processingState=failed, so Retry Failed may not list them). Verify recognition, stable count of three, and no new capture IDs. Real provider recovery/accuracy remains unverified by this hotfix; it requires owner-assisted production acceptance. Do not re-upload or modify the original tombstones.
