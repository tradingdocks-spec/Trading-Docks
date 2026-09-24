# Cloud inventory and Chaos authority

Status: **Implemented locally; requires separately approved database migration and deployment.** Production has not been changed by this implementation. POS, Square, scanner release gates, and physical certification are unchanged.

## Authority and identity

`chaos_sort_batches` remains the canonical batch header. V2 `chaos_scan_albums` extends it with private capture lifecycle and `chaos_scan_captures` holds physical slots, source references, and reviewed card metadata. Inventory ownership, workspace, positions, quantities, locations and immutable event history remain in the existing authoritative database model.

`chaos_scan_command('create', ...)` creates the album and draft header in one transaction. UUIDs and `CS-xxxxxx` codes are allocated by PostgreSQL. Codes are unique per inventory owner across that owner's workspaces, matching historical numbering; UUIDs are globally unique. The private counter is seeded from existing server records only. Existing duplicate owner/code pairs cause migration failure, never renumbering. No browser evidence is imported and batches 23–29 are not fabricated.

One unfinished or awaiting-label batch is allowed per owner/workspace. Creation has a UUID idempotency key. Owner-level transaction locks serialize creation and allocation; database constraints enforce capture UUID uniqueness and `(album_id, ordinal)` uniqueness with slots 1–100. Two workstations can safely share a draft without duplicate slots. This uses database locking, not an exclusive workstation lease.

## Lifecycle and resume

The server derives DRAFT, REVIEW and READY_TO_COMMIT from persisted capture records, with transactional COMMITTING and immutable CLOSED states. The browser's running/paused scanner indicator is a local device state, not proof of a committed batch. Draft destination and intake mode are fixed at creation. Title, acquisition cost, sorting rules, review metadata and review revisions are persisted. Stale review/settings revisions are rejected rather than silently overwriting another workstation's work.

On entry, the client asks the server for the current unfinished/awaiting-label batch; no local batch ID is required. It restores accepted captures, including unfinished recognition and reserved uploads. Acknowledged images remain available after browser loss or bridge disconnection. Recognition interrupted by a crash requires retry/manual review; it is not silently treated as confirmed. CSV quantity N becomes N persisted physical records. CSV metadata is stored atomically with slot allocation.

Review/settings edits display a pending-save indication and a leave-page warning until acknowledged. Unacknowledged keystrokes or a physical image that never reached the server are not claimed to survive device loss. Reserved image uploads remain blocked from commit until the same capture's upload is recovered.

At 100 slots the database rejects card 101, the scanner pauses, and accepted recognition work finishes. Removed/rejected physical cards still occupy their slot. All unresolved cards must be reviewed before commit. Commit reads persisted reviews and settings and calls the existing authoritative inventory writer. Original committed quantity records accepted inventory units; physical count includes every allocated slot. These can differ if a card was deliberately removed during review.

Commit is idempotent. The primary next action is **Print Batch Label**, followed by explicit **Label printed and batch filed** confirmation. Only then can **Start Next 100** allocate a new server identity, optionally inherit the destination, reset the physical count and retain the local bridge connection. Labels use the exact committed batch and its persisted physical count. The server cannot prove that a physical label was actually printed/filed; it records the owner's explicit confirmation.

## Private images and local preferences

Images use private `chaos-scans` Storage paths containing workspace/batch/capture IDs. Authenticated, scoped reads proxy the private image with no-store headers. Image decoding/normalization rejects invalid or oversized content. Clients cannot overwrite/delete source objects. CSV has no fabricated image object. V2 retention remains 30 days after commit; expired image bytes may be purged by the existing retention procedure while capture metadata, reviews, inventory and provenance remain. This is not an indefinite scan-image archive.

Local storage is limited to history collapse, UI preferences, workstation scanner selection and secure bridge pairing. It does not generate batch numbers or persist authoritative batch status, quantities, contents or commit state. Clearing a profile loses preferences/pairing, not acknowledged cloud records.

## Authorization

The API requires the existing collection-write capability. Database commands additionally require the canonical owner, owner membership, and active workspace. A POS employee/delegation does not grant general Chaos collector writes. Cross-tenant and anonymous access remain denied. Storage and capture reads retain RLS; private counter/trigger functions are not browser-callable. No service-role credential is supplied to the browser. Direct browser header writes are revoked; authoritative commands preserve the existing inventory writer and authorization triggers.

## Inventory and history reconciliation

`initial_quantity` is immutable committed history. `current_quantity` is maintained by a deferred trigger after authoritative inventory commands finish, including POS's existing arithmetic. The trigger locks affected headers and derives remaining quantity from inventory linked to the batch's positions, avoiding double subtraction after a sale or removal. Returns restore remaining quantity without rewriting original quantity or acquisition events.

History is server-only, keyset-paginated at 25 rows (RPC maximum 50), with a `(user_id, created_at, id)` index. It reports original committed quantity, authoritative remaining quantity, position and event totals, dates, creator and destination. Historical null-workspace headers remain visible only to their owner. Existing discrepancies are flagged, not normalized. The migration does not update historical headers, inventory, positions or event records. Historical ambiguous/shared position relationships still require an approved evidence audit; this change is not a repair of the earlier five-unit discrepancy.

The existing commit writer is extended only to preserve reviewed language/game metadata in inventory data, positions and acquisition events. Exact expected fragments are checked before that forward change; an unexpected writer definition aborts migration.

## Migration and release boundary

Apply only after a separate review/approval, in order:

1. `20260923204804_chaos_scan_albums_v2.sql` — private albums/captures, Storage policies and immutable guards.
2. `20260924000100_chaos_cloud_authority.sql` — server identity, immediate drafts, CSV metadata, optimistic concurrency, history, quantity reconciliation and metadata preservation.

Neither file has been applied to production by this task. Use an atomic transaction for the migration pair after checking the current baseline, owner/code duplicates, private bucket compatibility, backup/recovery and writer definition. Deploy the corresponding application only after the schema is verified. Do not deploy the cloud-only UI against an unmigrated database; it deliberately fails closed. Existing open pre-cloud browser drafts are not automatically imported. Drain/review them before rollout rather than inventing server identities.

Do not roll back by deleting cloud batches, captures, inventory or ledger history. Stop intake and use a reviewed forward correction if needed. Disabling scanner UI alone does not undo a committed batch.

## Validation

`tests/chaos-cloud-authority-db.mjs` runs only in a disconnected Supabase PostgreSQL 17 container cloned from the reviewed production-shaped rehearsal. It checks unchanged historical headers, server numbering, 42 concurrent allocations, replay, cap 100, stale-review denial, commit/label/next-batch invariants, original/current quantities, owner/security behavior and paginated history at 100/1,000/10,000 synthetic batches.

`tests/scan-albums/album.spec.ts` uses real local API/database operations with simulated recognition/bridge hardware and private local Storage emulation. It exercises 100 captures, lost-response recovery, review, commit, label gate, retained scanner connection, clean Chrome/Edge contexts reopening a 42-card draft, acknowledged capture 43 with disconnect/reload, and CSV/settings persistence. These are software acceptance tests, not physical scanner certification or a real second-computer hardware test.

Database rehearsal passed in `chaos_cloud_1790205775590` on the disconnected Supabase PostgreSQL 17 target. Concurrent creation produced one recoverable active draft, and 42 concurrent connections allocated distinct slots. Original quantity remained 100 through removal (99), cash sale (98), and inventory-restoring refund (99); 103 expected events remained. Refund replay did not add another event. The register closed at zero variance. The separate delegated-staff test created a legitimate site-scoped POS delegation inside a rolled-back fixture transaction and still verified Chaos/counter denial. Historical closed-header deletion was also rejected. Final rehearsal state had zero enabled POS workspaces and zero Square connections.

History returned disjoint 25-row pages at 100, 1,000 and 10,000 synthetic batches. A PostgreSQL `EXPLAIN ANALYZE` of the first 25-row page at 10,000 headers took 11.039 ms locally. Docker/CLI round trips took about 6.5 seconds for two pages and are not database latency. These synthetic headers have no large inventory contents; this is not a production load benchmark.

TypeScript, the production Next.js build and all 1,001 root tests passed. ESLint completed with zero errors; existing repository warnings remain. A pattern-based audit of 43 changed/untracked, non-ignored files found no credentials or private recovery artifacts. `git diff --check` passed. These checks are not a formal security certification.

All 14 browser scenarios passed across the three suites: eight workstation scenarios, five bridge scenarios and one extended cloud-album scenario. The workstation and bridge suites each required a focused rerun after correcting an outdated test assumption (settings timing around commit, and waiting for cloud acknowledgment respectively); their other cases passed in the full runs. The final 100-card workstation rerun recognized, reviewed and committed 100 cards in about 40.5 seconds on the local fixture, then verified label confirmation and a new batch with the scanner connected. This timing uses simulated recognition and is not a physical throughput claim. Expected offline-bridge errors in the recovery scenario were intentionally induced.

No production mutation, release, hardware PASS, or public installer distribution is implied.
