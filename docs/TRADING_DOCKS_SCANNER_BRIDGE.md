# Trading Docks Scanner Bridge V1

Status: **Implemented for internal engineering rehearsal. Public distribution and physical scanner acceptance PENDING.** Windows 11 x64 only. No production deployment, POS change, Square change, database migration or hardware certification is part of this work.

## Architecture

`Chaos Sort → ScannerProvider → TradingDocksLocalScannerProvider → HTTPS loopback → WindowsScannerBackend → WiaScannerBackend / ScanSnapBackend`.

Version 1.1.0 adds an internal ScanSnap iX500 image-output backend alongside unchanged WIA acquisition. See [ScanSnap backend](SCANSNAP_BACKEND.md) for vendor research, profile setup, capture destinations, validation and limitations. It requires a physical scan and a per-capture save in ScanSnap Home; direct SDK acquisition and physical acceptance remain pending. No production gate changes are included.

The existing development emulator remains separate and development-only. Captures enter the existing recognition/review queue and authoritative Chaos commit API; the bridge has no Supabase, marketplace, payment or cloud credentials. Test Scan creates only a browser preview, not a batch item. Live intake retains its 100 physical-card limit, inline exceptions, pause/resume, duplicate capture-ID guard and Start Next 100 behavior. Upload and CSV are unaffected.

The companion is .NET 10 LTS with Kestrel and a small WinForms tray. This avoids shipping an Electron browser while providing Windows certificate, DPAPI and STA COM support. The self-contained x64 installer includes its runtime, so end users do not need an SDK. Build machines need .NET 10. The installer is an internal artifact, not a production download.

## Windows scanner backend

`IWindowsScannerBackend` separates device discovery and capture from transport and business logic. V1 implements WIA Automation on a dedicated STA thread. Future TWAIN/vendor adapters must implement the same contract and pass the same security/capture tests; TWAIN is not implemented or claimed supported today. There is no Epson/Fujitsu-specific application logic.

Only WIA scanner devices with usable supported DPI and bounded region capabilities are returned. Identifiers are HMAC-derived with a workstation-local random salt; Windows device paths never leave the adapter. Friendly name, manufacturer, model, driver-managed connection, backend and supported options are returned. Driver-managed connection does **not** claim USB when the driver cannot establish that fact. Detected devices are untested, never automatically TESTED.

V1 offers 300/600 DPI only when reported by both axes, color, single-side capture and a bounded **3 × 4 inch** region. Align a card at the scanner origin. Unsupported settings are rejected. Auto-crop and duplex are not advertised by this WIA adapter. Other adapters can advertise them later. Fast/High Quality profiles select from the actual capability list. A scanner that cannot support the bounded region is omitted instead of accepting unlimited pages.

One transfer runs at a time, including feeders. WIA Automation `Item.Transfer` is synchronous; cancellation suppresses delivery and cancels queued operations but cannot guarantee interruption of a driver already inside Transfer. The hardware lock remains held until that call returns. Clear the device or restart the local bridge if a driver hangs. No second concurrent transfer starts to work around a hung driver.

Driver data is checked at 32 MiB and 20 megapixels before normalization, normalized to JPEG with a 2500-pixel maximum edge, then limited to 8 MiB by the protocol. The fixed acquisition region constrains ordinary driver output before decoding; a malicious/defective driver remains a trusted-native dependency, not a sandboxed image source.

## Loopback protocol and TLS

The production host binds only `https://127.0.0.1:47391`. It ignores configuration/environment listener overrides. Remote address must be loopback, Host must be `127.0.0.1`, and every request must carry an exact approved Origin. Default origin is `https://www.tradingdocks.com`; explicit reviewed staging/development origins may be listed in the local user's `origins.json`. No wildcards, LAN binding, cloud command channel or port forwarding.

The installer separately asks permission to install a unique per-user certificate. It generates a 90-day RSA3072 self-signed **leaf**, CA=false, serverAuth EKU, SAN 127.0.0.1/localhost. Its non-exportable private key lives in CurrentUser/My; only the public certificate is placed in CurrentUser/Root. There is no shared certificate/private key or signing CA. Expiry requires an explicitly reviewed installer/trust renewal; there is no insecure auto-update or automatic trust renewal.

Browser certificate validation is never disabled. Windows/Chrome leaf trust and current Chrome local-network permission behavior require physical acceptance on the intended workstation. A trusted leaf limits the intended certificate identity but does not eliminate the consequences of changing a user's trust store. That installer/trust decision remains a release review gate. The browser reports unreachable rather than claiming it can distinguish a missing installation from blocked trust, local-network permission or a stopped process.

## Pairing and authentication

1. Browser creates a P-256 key pair with a non-extractable private CryptoKey and a random 256-bit challenge.
2. `/v1/pair/start` validates the public key and challenge. The local tray displays the exact requesting origin and a six-digit code; the user must approve there.
3. `/v1/pair/finish` requires that challenge, origin and code within two minutes. Five wrong-code attempts invalidate the request. Pair challenges are replay-cached for ten minutes; each completion is single use.
4. The bridge stores a random credential ID, origin, public key and 30-day expiry in a CurrentUser DPAPI-encrypted file. The browser stores its non-extractable key and selected opaque scanner ID in origin-scoped IndexedDB. Nothing is organization-wide.
5. Every privileged request is signed with ECDSA/SHA256, IEEE P1363 encoding, over `METHOD\nPATH\nTIMESTAMP_MS\nNONCE_HEX\nSHA256_BODY_HEX`. Credential ID alone is not a bearer credential. Requests must be within 60 seconds; 256-bit nonces are remembered for two minutes. Reuse is rejected.

Unpair is available in the browser and tray. Tray unpair revokes all workstation browsers, invalidates pending pairings and clears image delivery. Browser unpair revokes its credential and clears its local trust. Local administrator/user compromise and XSS in an approved origin remain outside the protection of proof keys: non-extractability prevents raw key export, not malicious same-origin signing. Origin allowlisting complements authentication; it never replaces it.

## Endpoints and limits

| Endpoint | Access | Purpose |
|---|---|---|
| GET `/v1/health` | Approved origin | Minimal running/version metadata |
| POST `/v1/pair/start`, `/finish` | Approved origin + local approval/code | Establish trust |
| GET `/v1/status`, `/devices` | Signed | Paired workstation status and devices |
| POST `/v1/capture` | Signed | UUID request ID, requestedAt, opaque device, settings |
| GET `/v1/capture/{id}` | Signed, same pairing owner | Poll state / bounded base64 JPEG or PNG |
| POST `/v1/capture/{id}/ack`, `/cancel` | Signed, same pairing owner | Release image / suppress delivery |
| POST `/v1/unpair` | Signed | Revoke browser trust |

No filesystem browsing, arbitrary paths, process execution, arbitrary upload, proxy, command or cloud credential endpoint exists. Queries are rejected. Request bodies are limited to 16 KiB, connections to 24, headers to five seconds. Per-origin buckets limit pairing to 12 requests/minute, capture initiation to 240/minute (including CORS preflights), other requests to 1200/minute. Authentication/replay caches and pairing counts are bounded.

Capture initiation is idempotent for the same owner/request/settings. New requests older than two minutes are rejected; ten-minute tombstones prevent completed captures being restarted. One ready unacknowledged image applies backpressure. WIA images live in memory only; ScanSnap additionally uses one exact temporary JPEG in a unique bridge-owned capture directory. Acknowledgement/cancel/expiry clears memory and attempts exact-file deletion. Ready images expire after two minutes; metadata tombstones contain no images. ScanSnap's bounded cleanup retries old capture files after three minutes while the bridge runs. No scanner-image archive/logging exists. Requests time out/cancel after 90 seconds, subject to the WIA driver limitation above. See the ScanSnap document for locked-file/crash retention and vendor archive limitations.

Within a mounted browser provider, a lost initiation/poll response retains the original request ID for reconnect. Once image bytes arrive, an acknowledgement failure does not discard them; acknowledgement is retried before another capture. Existing intake deduplicates capture IDs. Browser reload does not persist undelivered image buffers; an interrupted transfer may need explicit rescan after expiry. Already delivered draft persistence follows the existing Chaos workflow. This is not an offline durable scanning spool.

## Browser feature gate

`NEXT_PUBLIC_SCANNER_BRIDGE_V1=1` is a non-production local harness opt-in only. Production uses the server-verified single owner/workspace acceptance gate described in `SCANNER_BRIDGE_OWNER_ACCEPTANCE.md`. Default is off; only approved owner dashboard responses permit the exact loopback endpoint in CSP and only the authorized Chaos Sort page enables controls. Development builds can select the existing emulator separately; production builds cannot expose it as a scanner.

The controls detect the bridge when entering Live Scan, pair, enumerate, remember/reconnect an available device, report a missing previous device, configure capability-aware profiles, Test Scan and Disconnect. Refresh is explicit; there is no continuous local-network discovery sweep. The disabled installer button clearly labels the internal release gate. Upload Instead remains available.

## Installer and release procedure

Build: `powershell -File scanner-bridge/build.ps1 -Dotnet <dotnet-10-path>`.

Output (Git-ignored): `scanner-bridge/artifacts/installer/TradingDocks.ScannerBridge.Setup.exe`. The script prints its SHA256. The installer is versioned 1.0.0, per-user, and installs under LocalAppData/Programs/TradingDocksScannerBridge. A separate trust prompt precedes normal use; startup is an explicit checked option. Installed Apps provides uninstall. Tray supports status, restart, unpair, startup toggle and exit. No administrator is needed for normal scanning.

Uninstall stops only the executable at the fixed install path, removes its exact certificate thumbprint from CurrentUser stores, pairing/local state, own startup/uninstall entries and installed files. Its temporary copied uninstaller is left to OS Temp cleanup. Browser-origin IndexedDB remains until Unpair/site-data removal, but its revoked server trust is unusable. Installation/uninstallation and certificate-store cleanup must be physically rehearsed before distribution; building an installer does not certify those behaviors.

Before general release: review threat model/source and installer; test current Windows11/Chrome trust + local-network permission; physically test at least one exact scanner/driver configuration; sign bridge/setup with the approved publisher Authenticode certificate and trusted timestamp; publish hashes through the authenticated release channel; verify publisher signature/hash before upgrade. An eventual updater must verify signed metadata, publisher identity, version rollback protection and package hash before replacement. V1 has no network updater.

## Future platforms

The versioned transport/device/capture contracts can host macOS ImageCaptureCore or Linux SANE adapters. Neither platform is implemented. New protocol majors require explicit browser compatibility; mismatched majors fail with Update Required, not best-effort capture. Physical support is exact model/driver/OS/browser/media acceptance, never inferred from a family name.

References: [Microsoft WIA Automation](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/wiaaut/-wiaaut-about-wia-automation), [WIA Item.Transfer](https://learn.microsoft.com/en-us/previous-versions/windows/desktop/wiaaut/-wiaaut-iitem-transfer), [Chrome Local Network Access](https://developer.chrome.com/blog/local-network-access).
