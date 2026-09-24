# Scanner recovery loop repair

Status: Implemented locally; production promotion and physical acceptance pending.

## Cause

The bridge reports readiness on each ten-second connection heartbeat. LiveScanStation used every readiness notification to retry a pending capture. An interrupted capture retains its original request and correctly returns CAPTURE_INTERRUPTED. The UI repeatedly started recovery anyway, entered Processing, and disabled the recovery controls. A concurrency guard prevented simultaneous requests but did not prevent repeated failed attempts.

## Change

- Attempt automatic recovery once when a pending request is discovered after mounting. If it fails, require an explicit Resume or confirmed Discard action.
- Serialize recovery inspection, retry, discard, and acquisition. Keep the recovery guard held until session pause finishes.
- Inspect pending state after acquisition finishes; block new scans and Test Scan while an unfinished request remains.
- Preserve automatic reconciliation after browser reload for a cloud-accepted capture whose acknowledgement was lost.
- For ScanSnap, say Waiting for ScanSnap and instruct the user to press the physical Scan button. Arming does not start the scanner motor.

No schema, agent binary, pairing protocol, authorization, cloud acceptance, or inventory writer changes. Pending state is not cleared automatically. No production browser, agent state, pairing, Inbox file, inventory, POS setting, or Square setting was changed during this repair.

## Validation

Validated 2026-09-24:

- TypeScript passed.
- Root suite: 1,014 tests passed (including 34 focused scanner protocol/access/authorization tests also run before editing).
- Scanner browser suite: all six scenarios passed. Five existing scenarios passed together; the new interrupted-recovery scenario passed after correcting a test assertion encoding issue. The new scenario observes two real heartbeat intervals, verifies no repeated recovery requests, permits one explicit retry, and confirms discard unblocks scanning without adding a card or inventory event.
- Cloud-album browser suite: four tests passed, including automatic recovery after a lost cloud response without a second capture, 100-card cap, immutable commit/label/next-batch workflow, cross-browser state, and intake-mode guards.
- Production build passed using `npm run build -- --webpack` (the local worktree shares dependencies through a junction).
- Full ESLint: zero errors, 551 warnings. Focused ESLint: zero errors, two pre-existing component warnings (effect state update and image element).
- Changed-file secret-pattern scan/manual diff review and `git diff --check` passed. No fixtures, credentials, or private artifacts included.
- Local browser smoke loaded the fixture; the recovery screenshot was inspected. The interrupted state remains actionable and explicitly blocks fresh intake.

All scanner traffic in browser tests is intercepted by the protocol mock; the fixture uses a disposable local Supabase-compatible database and synthetic cards. Initial fixture failures were resolved by waiting for initial cloud loading before destination selection and adding the mock pairing-renewal response. Negative tests intentionally simulate network/409 errors. These results do not certify physical hardware.

## Release boundary

This branch is local only. Do not resume physical acceptance until the reviewed web fix is deployed under owner authorization. No hardware certification is granted by simulated tests.
