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
