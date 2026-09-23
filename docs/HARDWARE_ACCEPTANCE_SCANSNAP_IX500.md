# ScanSnap iX500 physical acceptance — in progress

Status: **PENDING — owner pairing and physical scans required.** No physical PASS or public TESTED certification has been awarded.

## Candidate and workstation

- Candidate source: `fcfc686`, branch `codex/scansnap-backend`.
- Internal candidate: `TradingDocks.ScannerBridge.Setup-1.1.0-internal.exe` (unsigned, 180,042,008 bytes).
- SHA-256 verified before execution: `738684335D8D27DE6C260B6E968F11131DF6BC8D21C5C93A5D31F34A878BCE96`.
- Scanner: Fujitsu/Ricoh ScanSnap **iX500**, USB. Windows reports `ScanSnap iX500`, Image class, status OK. No serial number or additional exact SKU inferred.
- OS: Windows 11 Home, version `10.0.26200`, build `26200`.
- Chrome installed version: `154.0.8037.58` (64-bit as previously owner-reported).
- Bridge installed runtime: **1.1.0**, protocol 1.
- Session started 2026-09-23; 1.1.0 binaries verified at `2026-09-23T18:32:27Z`.

## Installation checkpoint

The hash-verified internal installer was launched on the owner's Windows workstation. Existing 1.0.0 binaries were present before installation; the installer replaced them with 1.1.0. No public distribution or production deployment occurred.

The installer requested local certificate replacement. The owner handled the trust prompts; the agent did not accept security prompts or bypass TLS/Windows protection. After the dialogs closed, a normal HTTPS request to `https://127.0.0.1:47391/v1/health` succeeded with certificate validation enabled and returned `running: true`, `bridgeVersion: 1.1.0`, `protocolVersion: 1`. The listener was verified as `127.0.0.1:47391` only.

**Packaging defect observed:** this candidate's installer window title and Windows uninstall DisplayVersion are still hard-coded to `1.0.0`. The actual installed DLL and health endpoint report 1.1.0. The candidate was not modified/rebuilt during acceptance. Runtime installation passed this checkpoint, but the package must not be described as having correct version labeling.

**Subsequent packaging correction (owner-authorized promotion):** the installer window and Windows app DisplayVersion now derive from the installer assembly release version. A compiled cross-artifact regression verifies agreement with the bridge assembly and runtime version. The corrected private EXE is still version 1.1.0, SHA-256 `16CF2A74F2B0B4B5F23F80E18426A37236F090BECECD5484F2C3B67905FAAA9B`. The earlier acceptance candidate is preserved separately. The corrected package was rebuilt but not reinstalled; it does not change any pending physical result.

## Browser / pairing checkpoint

The owner's existing Chrome Chaos Sort page reports **Scanner Bridge found — pair this workstation**. This is the previously owner-gated UI; no gate/configuration/deployment was changed. The browser's current batch is an empty, uncommitted draft. Inventory commit is prohibited during this acceptance session.

Secure pairing was initiated through the normal Pair this workstation control. Owner completion is pending at this checkpoint; no pairing code/key is copied into this report.

## Physical evidence matrix

| Gate | Current evidence / result |
|---|---|
| Windows USB detection | PASS, read-only device inspection |
| Browser dropdown identity/backend/connection | PENDING pairing |
| Physical Test Scan | PENDING |
| Exactly one preview, usable orientation/crop/resolution | PENDING |
| Test Scan does not enter batch/inventory | PENDING physical capture; no capture performed yet |
| Live batch 0 → 1 and recognition starts | PENDING |
| Five sequential physical captures | PENDING |
| Duplicate/stale-file physical acceptance | PENDING; prior mock assertions are not physical evidence |
| Disconnect / reconnect | PENDING owner hardware actions |
| Timeout / no scan | PENDING |
| Safe malformed-file simulation | PENDING; must be labeled simulated |
| WIA backend integrity | Implementation unchanged in fcfc686; prior regression tests passed. No WIA hardware certification claimed. |
| Loopback HTTPS / existing security | Approved-origin health HTTP 200; unsigned device enumeration HTTP 401; unapproved-origin health HTTP 403. TLS validated normally. |

## Remaining sequence

Finish owner pairing; verify iX500 dropdown identity. Prepare ScanSnap Home's separate Trading Docks Cards profile without overwriting existing profiles. For each capture save one JPEG to the exact new destination shown by the bridge. Test Scan first, then inspect preview, then five sequential live captures into the temporary uncommitted draft. Check stale-file protection, timeout, disconnect/reconnect and safe malformed-file rejection while preserving that draft. Never press Commit to Inventory.

The 90-second request deadline means the operator should be ready before Test Scan/Scan One is pressed. A manual Save dialog/destination step is required for every capture. The bridge cannot apply/verify the Home profile or stop its physical feeder. These limitations must be evaluated during physical acceptance rather than treated as already passed.

Production POS and Square configuration are untouched. No merge, deployment, global enablement, installer publication, inventory commit, or hardware certification change is authorized or performed in this checkpoint. Return to owner for physical actions; update this report with actual observations as the sequence proceeds.
