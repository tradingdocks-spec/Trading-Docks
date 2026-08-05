# Offline Sync

## Current State

- Implemented: Mobile has a cross-platform storage adapter in `mobile/services/storage/app-storage.ts`.
- Implemented: Native mobile uses AsyncStorage; mobile web uses `localStorage` after the browser exists.
- Implemented: Mobile has an offline operation queue in `mobile/services/storage/offline.ts`.
- Implemented: Mobile work sessions are persisted locally by `mobile/features/sessions/session-provider.tsx`.
- Partially Implemented: Offline operations can be enqueued, read, and cleared.
- Implemented: Collector organization mutations use typed queue entries with a user id and de-dupe key so duplicate offline writes for the same user/card/action are replaced by the latest queued write.
- Partially Implemented: Mobile exposes a Collector mutation replay helper that only attempts queued collector writes for the active user and leaves unrelated users' queued operations isolated.
- Partially Implemented: Mobile Collector mutations use optimistic UI and queue writes when Supabase is unavailable or a network write fails.
- Implemented: Mobile Collector offline replay recognizes proposed authoritative database errors including `TD_COLLECTOR_UNAUTHORIZED`, `TD_COLLECTOR_FREE_LIMIT_EXCEEDED`, `TD_COLLECTOR_INVALID_QUANTITY`, and `TD_COLLECTOR_MISSING_MEMBERSHIP`.
- Implemented: Authoritative replay failures are retained on queued operations with error metadata instead of being silently discarded.

## Missing Sync Behavior

- Planned: Queue replay to Supabase or a server API.
- Planned: Conflict detection and merge rules.
- Planned: Idempotency keys for writes.
- Planned: Network reachability tracking.
- Planned: Retry/backoff handling.
- Planned: User-visible pending/synced/error states.
- Planned: Data model for durable sync history.
- Planned: Production-grade Collector replay needs durable retry/backoff, server idempotency, and conflict resolution beyond latest queued write wins.

## Production Guidance

- Do not describe mobile offline sync as complete.
- Treat current offline support as local persistence and queue scaffolding.
- Before production mobile workflows depend on offline mode, define operation schemas for scan, buying, trade, card-show, and remaining inventory changes.
- Requires Production Configuration: DB-side Free-plan enforcement for direct native writes needs a reviewed Supabase RPC/trigger before mobile offline replay can be considered production-authoritative.
- Planned: After the proposal is applied in staging, offline replay should call the authoritative RPC path where practical and preserve failed writes for user-visible resolution.
- Planned: Staging validation must replay duplicate queued quantity writes and confirm repeated replay is idempotent from the user's perspective: the latest queued quantity should remain the final value, and authoritative errors must keep the queued operation visible for resolution.
- Planned: Staging validation must include sign-out/user-switch isolation so a queued mutation for one user cannot replay under another user's session.
- Implemented: Mobile collection cache remains scoped by auth user id and now represents the cached first page for the active query surface instead of implying a complete offline collection mirror.
- Partially Implemented: Offline first-page fallback is useful for stale browsing, but paginated offline continuation is not implemented; queued replay still needs durable retry/backoff and user-visible conflict resolution.

## Storage Location Offline Behavior

- Implemented: Mobile storage assignment/move operations enqueue as `collector_storage_location_assignment` when the online Supabase write fails.
- Implemented: Storage assignment queue entries include `userId` and a de-dupe key scoped by user and inventory item, so repeated moves for the same card replace earlier queued moves instead of replaying duplicates.
- Implemented: Replay only attempts queued storage-location assignments for the active user and leaves other users' queued operations isolated.
- Partially Implemented: Failed replay keeps the queued operation with `lastError`; the UI surfaces pending-sync messages but does not yet provide a full conflict-resolution inbox.
- Planned: Create/rename/archive location operations currently require online Supabase access. Offline support is limited to assignment and move operations until durable hierarchy conflict rules are approved.

## Trade Binder And Wishlist Offline Behavior

- Implemented: Mobile trade status, wishlist priority, and wishlist add/remove mutations use `collector_trade_binder_wishlist_mutation` queue entries when the online write fails.
- Implemented: Queue de-dupe keys are scoped by user, target id, and mutation type so repeated updates replace stale queued writes for the same card or wishlist row.
- Implemented: Replay only attempts queued Trade Binder/Wishlist operations for the active user and preserves other users' queued operations.
- Partially Implemented: Failed replay records `lastError` and the screen surfaces pending-sync messages, but there is not yet a dedicated conflict-resolution inbox.
- Planned: Trade-calculator and card-show prep workflows should consume these queued states rather than silently hiding failed updates.

## Scanner Offline Behavior

- Implemented: Scanner confirmation writes queue as `collector_scanner_collection_add` when Supabase is unavailable or the insert fails.
- Implemented: Scanner queue de-dupe keys are scoped by user, exact printing, finish, condition, and storage assignment.
- Implemented: Manual search can show cached recent candidates while offline when a recent match exists.
- Partially Implemented: New online card search and future OCR/image recognition require network access.
- Partially Implemented: Queued scanner adds do not yet have a dedicated replay worker or conflict-resolution inbox; they are preserved in the shared offline queue.
