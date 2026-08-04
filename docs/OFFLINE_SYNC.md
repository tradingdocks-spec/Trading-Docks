# Offline Sync

## Current State

- Implemented: Mobile has a cross-platform storage adapter in `mobile/services/storage/app-storage.ts`.
- Implemented: Native mobile uses AsyncStorage; mobile web uses `localStorage` after the browser exists.
- Implemented: Mobile has an offline operation queue in `mobile/services/storage/offline.ts`.
- Implemented: Mobile work sessions are persisted locally by `mobile/features/sessions/session-provider.tsx`.
- Partially Implemented: Offline operations can be enqueued, read, and cleared.

## Missing Sync Behavior

- Planned: Queue replay to Supabase or a server API.
- Planned: Conflict detection and merge rules.
- Planned: Idempotency keys for writes.
- Planned: Network reachability tracking.
- Planned: Retry/backoff handling.
- Planned: User-visible pending/synced/error states.
- Planned: Data model for durable sync history.

## Production Guidance

- Do not describe mobile offline sync as complete.
- Treat current offline support as local persistence and queue scaffolding.
- Before production mobile workflows depend on offline mode, define operation schemas for scan, buying, trade, card-show, and inventory changes.
