# Chaos Sort live scanner workstation

Status: **Implemented for development/emulated acceptance; physical scanner integration is not implemented.** No generic TWAIN/WIA, USB, HID or camera-device support is claimed. No production deployment or inventory mutation is part of this work. POS and Square are unchanged.

## Existing architecture retained

The workstation still owns a `ChaosSortBatch` containing `ChaosSortItem` records. Image intake calls `/api/purchasing/card-photo-scan`; printing correction calls the existing `/api/card-intelligence/search`. Review and destination overrides remain inline. Commit uses `/api/chaos-sort` → `requireApiCapability("collection.write")` → the authenticated `commit_chaos_sort_batch` RPC. The RPC remains responsible for workspace/owner authorization, immutable committed-batch replay, canonical inventory identity, physical positions, acquisition events and idempotency. There is no scanner-specific inventory writer, schema migration or authorization change.

Inspection covered the workstation's uploads/CSV, recognition/retry queue, manual identity fields, batch target helpers, the batch-detail/reprint screen, current commit RPC and workspace-authority forward repairs, Label Studio links, and mobile camera capture contracts. Mobile's native camera/URI interface is not a browser document-scanner driver; its native SDK is not imported into the web app.

## Workstation behavior

- Batch History defaults collapsed on desktop and mobile. The local `td.chaos.history-open` preference remembers expansion. Existing batch/status/location/quantity/date/reprint columns remain; history links open the existing batch-detail screen rather than loading old batches into active intake.
- Active batch identity, intake mode, physical-card progress, destination and scanner/review controls lead the workspace. Upload Images and CSV retain their existing recognition/review paths.
- Live Scan becomes the default in development after configuring the emulator. Production defaults to uploads because no physical provider is installed.
- The workstation capacity is **100 physical cards**, including imported quantities, not 100 line items. Staging, CSV, quantity edits and repeated intake cannot silently exceed capacity. A live capture always represents one copy; live quantity is not editable.
- Capture is serial at the device boundary. Recognition runs in one shared four-worker pool across intake calls, with a maximum of eight outstanding live image jobs. Acquisition can continue while earlier images are recognized. Provider retries remain bounded by the existing recognition policy.
- Each successful capture has a unique receipt ID. A replayed receipt is rejected. Identical image bytes from different physical captures remain separate cards and increase the counter separately; duplicate-image provenance remains visible.
- States are textual: CAPTURING, PROCESSING, CONFIRMED, NEEDS REVIEW, UNKNOWN and FAILED. Machine confidence and human confirmation are separate. Auto-confirm applies only to a single unambiguous high-confidence candidate, and can be disabled. Ambiguous/unknown printings are never silently accepted.
- Review shows the source image, candidate printings, manual search/selection, condition, finish, language and per-card destination. A manual correction does not manufacture machine confidence. Confirmation requires a resolved card/printing and finished recognition.
- The batch destination is chosen once; cards inherit it. Overrides remain available. `TDLOC:` input is restricted to the location-assignment control and validated against available locations, not sent to recognition as a card.
- Pause cancels the in-flight physical capture and starts no further captures; queued recognition may finish. A capture failure/jam/disconnect leaves earlier cards intact. Reconnect or switch to Upload Images. Rescan replaces one existing item without incrementing physical count; a failed acquisition leaves the original intact.
- At 100, new capture controls stop. Resolve exceptions before Commit; changing modes does not bypass capacity. Test Scan previews an image without consuming a batch slot or writing inventory.
- Commit is guarded against in-flight capture/recognition, staged files, missing destination, unresolved cards and repeat clicks. The HTTP handler additionally validates live batches before invoking the same authoritative RPC.
- After successful commit, the batch is read only. Results use RPC counts for cards, new positions and updates to existing inventory identities; these are not guessed from UI rows. Print Labels and View Inventory retain existing routes.
- Start Next 100 creates a new batch UUID and resets items/counts while retaining the provider connection. The first transition asks whether to carry the destination; subsequent committed batches reuse that choice. Starting over with an uncommitted draft requires explicit confirmation and warns that the draft will be discarded.

## Scanner-provider boundary

`ScannerProvider` exposes capabilities, `detect`, `connect`, `disconnect`, `getStatus`, `capture`, `cancelCapture`, `getDeviceInfo` and `configure`. Its output is a `File` plus a stable capture receipt ID. It does not recognize cards, select inventory owners or write inventory. The workstation feeds those files into its existing image intake.

The deterministic emulator supports successful captures, duplicate physical images, slow capture, capture failure, jam and disconnection. Fixture files enter the same hashing, item creation, recognition, review and commit pipeline as future hardware images. Recognition itself is deterministic only in the isolated test server, not in the application. Emulator construction and fixture controls are development-only; a production build cannot activate them using a browser preference or runtime flag.

There is currently **no continuous video preview**: the preview is the most recently captured image. There is no unreviewed localhost service. Sounds and extra scanner hotkeys are not enabled; native form controls remain keyboard-operable, and the existing physical-sort shortcuts ignore typing fields. Status never depends only on color.

## First physical scanner integration

Select and physically validate an exact image-scanner model, driver version, OS and transport. A barcode reader that only emits text cannot capture card artwork for this workflow. Browser uploads remain distinct from device capture.

TWAIN/WIA generally require a native Windows companion or vendor SDK. A future integration may use:

```text
Trading Docks browser → paired secure loopback bridge
                     → native scanner service → TWAIN/WIA/vendor driver
```

Before shipping that bridge, review at least:

- Loopback-only binding, authenticated pairing, short-lived per-session authorization and explicit connect consent.
- Exact HTTPS origin allowlist, CSRF/replay protection and no wildcard CORS or unauthenticated local endpoints.
- Safe transport/certificate strategy compatible with browser private-network restrictions; no instructions to bypass certificate warnings.
- No arbitrary filesystem/command/device access, no hosted service-role credentials, no production marketplace/Square secrets.
- Image type/size validation, bounded buffers and rate limits, cancellation, device timeouts, duplicate receipt handling and exclusive capture ownership.
- Auditable disconnect/reconnect behavior, driver errors/jams, device identity, removal/rotation of pairing authorization and secure updates.

Future camera or WebUSB/WebHID providers must advertise only their actual device capabilities and undergo the same lifecycle tests. Physical certification remains pending for every device.

## Rehearsal and limits

Commands:

```text
node --test --experimental-strip-types tests/chaos-live-scanner.test.ts
npx playwright test --config playwright.chaos-live.config.ts
npm run check
npm run build
```

The browser fixture server copies the actual workstation and commit HTTP handler into a temporary Next app with synthetic context and recognition adapters. It clones the already-verified local Supabase recovery schema/data into a uniquely named disposable `chaos_live_*` database, creates a synthetic owner, and exercises the real authenticated RPC. It requires `supabase_db_trading-docks-recovery-test`, Supabase Postgres 17 and **no Docker networks**. It binds only `127.0.0.1:4320`, has no hosted backend configuration, and never points Vercel at the fixture. Do not expose this development server publicly. The recovery source and backup artifacts are not overwritten.

Browser coverage includes collapsed history/actions, 1/25/50/100 cards, high-confidence opt-out, unknown printing correction, capacity 101 rejection, pause/resume, failure/jam/disconnect, rescan/removal, destination inheritance, immutable/idempotent commit, database inventory/position/event totals, Start Next 100 connection retention and mobile CSV/location QR. Unit tests cover device state transitions, cancellation, physical quantity, readiness guards and shared four-worker concurrency.

Drafts and captured-image previews remain browser-memory state, as in the previous upload workflow. Closing/reloading the page loses an uncommitted draft; this is not offline durable intake. No blob URL is claimed to be durable archival storage. Provider/recognition timing measured in emulator tests is not a physical-throughput or real recognition-service benchmark. Hosted Auth, real scanner drivers, physical image quality and physical hardware acceptance remain separate gates.

The current repaired RPC rejects a repeated commit without `sessionId` with an atomic HTTP 409 (`commit already exists or conflicted`): its unique session allocation precedes the closed-batch replay check. Rehearsal verifies this creates no duplicate inventory, positions, batches or events. This existing behavior is retained, not changed through a new writer or migration. If a commit response is lost, inspect Batch History before starting over; automatic response-loss recovery is not added by this UX change.

## Local validation — 2026-09-23

- `npm run check`: **975 tests passed**, TypeScript passed, ESLint zero errors (advisory warnings remain), dependency audit zero vulnerabilities.
- `npm run build`: passed. Production client chunks contain no emulator fixture controls or connection implementation.
- Browser coverage: **eight distinct scenarios passed** (seven-scenario suite plus an additional upload/history-persistence test). The 100-card workflow was rerun with a fresh oversized batch identity: HTTP 400 before RPC execution, with database counts unchanged.
- The complete 100-card recognition/review/real-RPC commit took about 25–30 seconds in the emulator fixture. Each successful commit added exactly 100 inventory units, 100 positions, 100 acquisition events and one batch for the synthetic owner. Duplicate retry added nothing. All disposable workspace POS settings stayed disabled.
- Desktop visual inspection: compact history, active-batch hierarchy, station controls, inline inspector and no browser console errors. The 390px mobile CSV/QR test passed with no horizontal overflow. Existing upload intake and persisted history expansion passed.
- `git diff --check` passed; changed-file secret audit found no credentials or production exports. No new dependencies, migrations, production data writes, deployment or POS/Square configuration changes.

Physical hardware acceptance remains pending. Production promotion requires a separate reviewed deployment.
