# Scanner Agent Phase 1 — internal implementation candidate

Status: **Partially Implemented / release gate PENDING**. Branch `codex/scanner-agent-phase1`. Phase 2 has not started. No production changes, installed-agent replacement, installer publication, inventory commit, POS/Square change, or certification promotion occurred during this implementation.

## Recovery model

The Windows agent now stores capture intent before acquisition and encrypted image bytes before delivery. Recovery journals use Windows DPAPI CurrentUser, application-owned fixed paths, write-through temporary files and atomic replacement. Pending records do not silently expire when a browser or agent is offline. An unacknowledged image or uncertain interrupted acquisition blocks another hardware request. An interrupted driver request without a durable image requires explicit local-attempt discard; it is never silently rescanned.

Inbox session identity, accepted count, preexisting-file baseline, claimed files and pending bytes survive restart. Stable new files remain bound to the original session. Files are cleaned only after acknowledgement or explicit discard. Acknowledgement is journaled before cleanup; retry returns the same capture identity. Test previews recover into preview only, never into cloud intake. Completed tombstones are bounded and aged out after the request acceptance window. Corrupt/unreadable journals fail closed and surface recovery attention rather than silently resetting.

Browser IndexedDB retains the nonextractable signing key, credential, remembered device, active local capture binding and acknowledgement intent. Automatic detection retries every ten seconds while visible, and on online/visibility events. Existing valid pairing renews via signed request; expired/revoked trust cannot renew. Forget/re-pair is blocked while this browser has pending recovery. Clearing browser storage or revoking trust is not routine recovery: it requires controlled operator investigation, not transferring old captures to a new identity.

Cloud remains authoritative for destination, batch, acceptance, recognition, review and inventory. Agent persistence contains hardware preference and temporary recovery only.

## Capture authorization and release configuration

New agents require P-256 signed, two-minute cloud permits binding user, workspace, batch, destination, workstation, session, device and capture ID. A live acknowledgement permit requires the existing cloud snapshot to contain that capture in RECEIVED state. Preview permits cannot acknowledge a live capture. Requests retain exact-origin, HTTPS loopback, pairing signatures and durable replay rejection. The server checks its existing authenticated capability and authoritative snapshot RPC; no RLS or migration changes are included.

**Requires reviewed configuration before installation/release:** server-only `SCANNER_CAPTURE_SIGNING_KEY` and the corresponding public PEM allowlist in the agent's fixed `capture-public-keys.json`. No keys were generated for production or configured there. Missing keys fail closed. Private keys and service-role credentials must never ship in the agent. Existing installed 1.2.0 remains untouched; protocol capability detection preserves the existing application path for that version. Candidate runtime/installer metadata is 1.3.0; no usable signed installer is claimed.

## UI

Automatic reconnect restores the remembered device without repeated manual refresh. Scanner names are primary; driver details, diagnostics, manual refresh and Forget live under Scanner Settings → Advanced. WIA uses Scan One / Start Continuous Scan. ScanSnap uses Arm One Capture / Arm Continuous Capture and explicitly asks for the physical Scan button. Local preview and unfinished-capture status remain visible. The fixed Trading Docks Inbox is created/observed automatically; ScanSnap Home still requires its one-time vendor profile pointed at that owned directory. This implementation does not claim to provision undocumented ScanSnap profiles or trigger iX500 hardware.

## Files

- Native: Core/Captures.cs, ScannerInbox.cs, Trust.cs, BridgeHost.cs, Protocol.cs; new RecoveryStore.cs and CaptureAuthorization.cs.
- Windows: new EncryptedRecoveryStore.cs, Program.cs and version metadata in Windows.csproj / Installer.csproj.
- Web: local-scanner-provider.ts, scanner-provider.ts, scan-album-client.ts, new capture-permit.ts, scans API route, ChaosSortWorkspace.tsx, LiveScanStation.tsx, ScannerBridgeControls.tsx.
- Tests: native RecoveryTests/InboxTests/Program, WindowsTests, scanner-bridge.test.ts, scanner-capture-permit.test.ts, scanner browser/album suites and isolated fixture helpers.

Paths above are relative to scanner-bridge or src/lib/chaos-sort as applicable; unrelated preexisting local reports are excluded from this work.

## Production installer design (planned, not certified)

Use an Authenticode-signed installer/payload and signed version manifest, timestamped by an approved signing service. Keep signing secrets out of Git and customer machines. Default per-user Windows startup must retain the existing workstation ID, DPAPI trust records, certificate and recovery directory across upgrade. Verify the payload/manifest before extraction and stage in a versioned application directory. Refuse upgrade while acquisition or unacknowledged recovery is active; do not terminate an active scanner to install.

Certificate renewal must validate ownership and loopback SAN, retain the currently trusted certificate until replacement succeeds, and request explicit Windows trust when necessary. Never suppress protection warnings. Maintain a protected minimum accepted version to prevent rollback into an insecure release; permit deliberate rollback only to a reviewed compatible version without discarding recovery data. Health-check the staged version before switching startup; revert executable selection on failure. The present internal installer does not yet implement/certify this production updater and remains private/unsigned. Do not run its existing stop-and-replace upgrade while captures are pending.

## Release-gate evidence and remaining physical work

Automated results are recorded below after validation. They are emulated/software checks, not physical certification.

Pending real gates: full Chrome exit/restart, Windows reboot, installed agent restart/crash with the actual scanner, fresh pairing/re-pairing, actual iX500 capture, and verification against existing CS-000023 with no inventory mutation. Browser refresh and process-reconstruction tests do not prove Windows reboot acceptance. Power-loss durability beyond successful atomic filesystem writes is not certified.

Physical plan, after review/configuration and a private candidate install:
1. Record Windows/Chrome/candidate versions. Verify certificate, loopback listener and unchanged pairing/workstation. Confirm existing CS-000023, destination and count before intake; do not create another batch.
2. Verify browser refresh, full Chrome restart, agent restart and controlled Windows reboot preserve pairing/device and draft. Perform these with owner participation; do not reboot remotely without coordination.
3. Arm one Test Scan, press iX500 Scan once, receive one usable preview and zero cloud intake/inventory changes.
4. Arm exactly one live capture in the existing authorized draft. Press Scan once. Verify one reserved/received private capture, one counter increment, recognition/review, same destination and no inventory commit.
5. Controlled fault injection on isolated fixtures first: stop agent before upload, lose upload response, lose acknowledgement response, restart and retry. Verify same capture ID, one acceptance, no stale-file ingestion, exact cleanup only after durable acceptance. Repeat relevant real restart checks with owner coordination; do not create extra production captures merely to fill a gate.
6. Keep certification pending and return for owner review. Phase 2 and production deployment remain unapproved until the Phase 1 release gate passes.

## Validation record — 2026-09-24

- Root suite: 1,009 tests passed; TypeScript and ESLint passed (existing warnings remain); dependency audit zero vulnerabilities. Final lint reports 551 warnings (baseline 548), zero errors; warnings are not being represented as a warning-free run.
- Native suite: 403 security/contract assertions passed, including encrypted-journal reconstruction, original identity recovery, lost ACK, Inbox restart, orphan exclusion, tenant/binding rejection and replay rejection across restart.
- Windows diagnostic: real DPAPI encryption/reopen/atomic replacement passed; image validation, hard-link rejection and consistent 1.3.0 version metadata passed. This does not operate a physical scanner or install trust.
- Browser scanner suite: all five scenarios passed across the full run and focused reconnect rerun. Includes pairing, automatic device restoration, cancellation/disconnection, profiles, previews, mobile UI and 100-card workflow.
- Private album/mode suite: all four scenarios passed across full run and focused guard rerun. Lost response plus refresh reconciles automatically without a second capture; cross-browser draft/mode persistence and 100-card/closed-batch/label gating passed against disposable local Supabase-compatible fixtures.
- Initial failures were diagnosed: missing new module in the fixture copy list, polling assertion shorter than reconnect interval, simulator returning ready after cancellation, obsolete manual-recovery control assertion, and WIA assertion using the physical-button label. Corrected fixtures/assertions and reran each failed scenario; no failed gate is being counted as a pass.
- Production build and final secret/diff audit: see final completion entry below. Logs remain in ignored `.local-fixtures`, not production exports or published artifacts.

Release remains **NOT READY FOR PRODUCTION** until reviewed signing-key provisioning, private installer handling, and the real restart/physical gates above pass. No physical model is promoted to Verified/TESTED.

Final completion entry: `npm run validate` passed (TypeScript, lint, 1,009 root tests, dependency audit and optimized production build). Secret-pattern/known-fixture audit and `git diff --check` passed. No installer was rebuilt or installed; the compiled Windows diagnostic validates version metadata and DPAPI only.

Recovery limitation: ScanSnap Home initially writes a normal JPEG in the application-owned Inbox. The recovery journals are DPAPI-encrypted; the vendor source file remains there until acknowledgement/explicit discard. This is not a claim that all vendor-created files or the entire disk are encrypted. Preserve restrictive Windows-user access and the established source-retention rule.
