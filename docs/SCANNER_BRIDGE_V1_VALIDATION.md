# Scanner Bridge V1 validation

Date: 2026-09-23. Branch: `codex/scanner-bridge-v1`.

**Engineering implementation validated for internal rehearsal. Public release NOT READY. Physical scanner acceptance PENDING.** No deployment, production database operation, POS/Square configuration change, hardware certification promotion, certificate installation or runtime bridge installation was performed.

## Implemented

- Windows11 x64 .NET10 tray companion, WIA adapter, private loopback HTTPS, versioned protocol, capability validation, image bounds, capture/ack/cancel lifecycle.
- Local approval + expiring one-time pairing; non-bearer P-256 proof credentials; per-origin trust, signed nonce/timestamp requests, replay/rate limits, revoke.
- Feature-gated browser provider/device dropdown, local remembered scanner, Fast/High Quality/custom settings, test preview, existing live recognition/100-card workflow, missing/offline/jam states.
- Internal per-user installer, startup option, uninstall path, unique leaf trust bootstrap, build hash. Authenticode signing and physical install/trust/uninstall acceptance remain release gates.

## Validation results

| Gate | Result / evidence |
|---|---|
| Baseline before changes | 975 root tests, TypeScript, lint with no errors, dependency audit passed |
| Root suite after implementation | **983/983 PASS**, including eight new browser-provider contract tests |
| TypeScript | PASS |
| ESLint | PASS, zero errors; 545 warnings (544 existing, one connection-refresh effect warning) |
| Production-mode Next build | PASS; bridge flag default OFF |
| Native Windows build | PASS, zero compiler warnings/errors |
| Actual HTTPS loopback security tests | **36 assertions PASS**; no Windows trust-store changes |
| Mock bridge browser E2E | **4/4 PASS** |
| Existing Chaos workstation browser regressions | **8/8 PASS** |
| Disposable authoritative DB commit | PASS; +100 cards, +100 positions, +100 events, +1 batch; zero POS-enabled workspaces |
| Secret audit | PASS; changed source/docs/tests and browser bundles; known fixture secrets plus private-key/token patterns; no binary/dump/private fixture staged |
| Installer build | PASS; internal artifact only, not installed/distributed |
| Physical scanner / Windows trust / Chrome LNA | **PENDING**, no physical scanner tested |
| Formal security and installer acceptance / signing | **PENDING before distribution** |

The final source diff is restricted to the bridge, browser integration, test harness/tests, CSP opt-in and these documents. Existing authoritative inventory writer, migrations, cloud environment, mobile app and hardware catalog were not changed. The unrelated local inventory-removal execution report remains untouched.

## Real TLS/security boundary

`scanner-bridge/Tests` starts the actual Kestrel host with an ephemeral test certificate. The test client validates its exact certificate through a private CustomRootTrust chain and hostname verification; no global trust or TLS validation bypass is used. Windows Schannel requires importing the test PFX into a process-lifetime user key container, not adding it to certificate stores.

Tests prove:

- Only `https://127.0.0.1` listens, even with malicious Kestrel/ASPNETCORE environment endpoint overrides.
- Unpaired enumeration, wrong origins, DNS-rebinding hostname, invalid credentials/proofs and replayed signed requests are denied.
- Pair completion is origin/challenge-bound, single-use and expires; repeated pairing challenge is denied.
- Capture IDs are idempotent, another pairing cannot read a capture, one unacknowledged image blocks another capture, repeated ACK is safe, ACK clears image data.
- Old capture initiation, oversized image and unsupported settings are rejected; cancellation suppresses delivery.
- Expired/revoked trust and excess pairing requests are denied.
- File, execute, proxy and arbitrary-upload endpoints do not exist; arbitrary query paths are rejected.

## Browser and pipeline evidence

The mock implements the real versioned HTTP shape and verifies each ECDSA signature, nonce uniqueness and expected origin. It does not call Windows WIA and is explicitly **EMULATED PASS**, not physical acceptance. Public/local-network certificate permission is not bypassed in production code; mocked transport cannot certify OS/browser trust prompts.

The 100-card test pairs, enumerates/selects a mock WIA scanner, negotiates 600 DPI, confirms duplex is unavailable, performs a test scan without consuming a batch slot, then captures 100 separate images. One recognition exception is resolved inline. Both capture actions disable at 100, and only 101 protocol captures exist including the separate test scan. All 101 are acknowledged. Commit uses the real application API and `commit_chaos_sort_batch` against a fresh disposable Supabase-compatible database. Exact fixture-owner deltas are checked, then Start Next 100 resets the batch while preserving scanner selection.

Other cases cover reconnect after page reload, remembered device absence, jam, cancellation, disconnection without losing the draft, unavailable/old bridge with Upload retained, and 390px mobile device/settings layout without overflow. Provider unit tests additionally prove lost initiation response reuses its request ID and lost acknowledgement still returns the received image exactly once before retrying ACK. A browser-only native-fetch receiver bug found by E2E was corrected; unit mocks alone would not have caught it.

Existing eight browser tests cover 1/25/50/100 cards, duplicate commit denial, 101-card server rejection, inline correction, quantity accounting, mobile CSV, history preference, image upload, pause, rescan and item removal. Expected injected connection errors and the intentional duplicate-commit rejection are not production failures.

## Reproduce

```powershell
npm run check
npm run build
dotnet run --project scanner-bridge/Tests
powershell -File scanner-bridge/build.ps1 -Dotnet <dotnet-10-path>
node scanner-bridge/audit.mjs
git diff --check
```

Browser rehearsal requires the existing network-isolated `supabase_db_trading-docks-recovery-test` container and `collector_removal_rehearsal` template. The harness refuses a running network-attached/non-Supabase target, clones a fresh timestamped database, uses a synthetic owner and never loads a hosted environment file. It does not overwrite staging/recovery databases. Disposable clones remain local for evidence.

```powershell
npx playwright test -c playwright.scanner-bridge.config.ts
npx playwright test -c playwright.chaos-live.config.ts
```

The first command sets the bridge flag only in its local harness subprocess. Neither command changes Vercel settings or runs production migrations. Physical hardware is not needed for mock tests.

## Internal artifact

`scanner-bridge/artifacts/installer/TradingDocks.ScannerBridge.Setup.exe`

- Version: 1.0.0, self-contained Windows x64.
- Size: 180,029,720 bytes.
- SHA256: `B460922CB2C7C61274769B1A8A53A5DB50F3064B4D1DB8E6AB4084099FF4FDCD`.
- Build SDK: .NET 10.0.401; the build-only SDK was placed outside the repository.
- Unsigned, internal only. Build outputs are Git-ignored. Rebuilding may change the artifact/hash; use the build script's current output for review.

## Known limitations and release gates

1. WIA-compatible installed drivers only; TWAIN/macOS/Linux are not implemented. No exact hardware model is certified.
2. Fixed 3 × 4 inch capture region, color, supported 300/600 DPI, one side/transfer at a time. No advertised automatic crop, duplex or guaranteed physical WIA cancellation.
3. A stuck synchronous driver may require local bridge restart; cancellation prevents delivery, not necessarily physical feeder motion.
4. Capture buffers are transient, not durable across browser/bridge restart. Wait for expiry/reconnect and explicitly rescan undelivered media. Do not imply an offline spool or crash-proof intake queue.
5. Leaf-certificate installation/renewal, cleanup, Windows startup/uninstall and Chrome HTTPS/local-network permission must be physically rehearsed and reviewed. No TLS-warning bypass is allowed.
6. Publisher code signing, trusted timestamp, reviewed download/hash channel and update verification are required before customer distribution. V1 has no updater.
7. Tests establish implementation evidence, not an independent security certification. Formal source/security review and at least one physical scanner acceptance remain mandatory before release.

**Production remains untouched. POS and production Square remain unchanged. Physical scanner certification remains PENDING.**
