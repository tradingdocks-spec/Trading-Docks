# ScanSnap iX500 backend — internal acceptance build

Status: **Implemented file-output coordination; physical capture acceptance PENDING.**
Branch: `codex/scansnap-backend`. Bridge version 1.1.0, protocol 1. No production deployment, gate change, certification change, POS change or Square change is included.

## Investigation and selected integration

The owner's USB iX500 is visible to Windows Plug and Play and ScanSnap Home, but not the WIA adapter. ScanSnap uses its own driver rather than ordinary TWAIN/ISIS acquisition. [Ricoh driver FAQ](https://scansnap-faq.pfu.ricoh.com/hc/en-us/articles/12818045825177-Do-you-make-any-scanners-that-support-TWAIN-ISIS).

Read-only workstation inspection on 2026-09-23 found ScanSnap Home `PfuSshMain.exe` 3.6.0.2 in the standard `Program Files (x86)\PFU\ScanSnap\Home` directory, plus WebSDK client/service runtime binaries. No developer SDK package, headers, API guide or documented command-line capture contract was available locally. Runtime presence does not authorize guessing DLL exports, command arguments, or private service protocols.

Ricoh provides an SDK through registration/request. Its public overview describes Home integration but does not supply the invocation contract needed for this implementation. Current model coverage also needs vendor confirmation for this older iX500. No SDK request was submitted, license accepted, proprietary binary inspected, process injected, or undocumented executable invoked. [Official SDK information](https://www.pfu-us.ricoh.com/scanners/sdk), [SDK overview/model coverage](https://www.pfu.ricoh.com/scansnap/support/sdk/info-sdk.html).

Documented custom-application hooks exist, but a usable argument/acknowledgement contract was not established. The chosen fallback uses Home's documented image-save workflow, with the user selecting the exact destination for each capture. This deliberately avoids monitoring a general ScanSnap output folder. [Application integration guide](https://www.pfu.ricoh.com/imaging/downloads/manual/ss_webhelp/en/help/webhelp/topic/ope_appli_mgr.html).

## Detection and routing

`WindowsScannerBackend` composes the unchanged `WiaScannerBackend` with `ScanSnapBackend`.

Enumeration runs independently per backend, waits at most two seconds per refresh, and retains one in-flight probe for a slow driver rather than enqueueing more COM operations. A failed/stalled backend does not hide another backend's devices. Refresh again for a slow WIA driver once its probe finishes. Capture routing uses only IDs returned by backend enumeration.

The Windows adapter checks for the standard ScanSnap Home executable and uses documented SetupAPI present-device enumeration. It requires both the observed iX500 USB product identity (`VID_04C5`, `PID_132B`) and installed driver description containing `iX500`. It does not depend on WIA or read ScanSnap's private configuration. Nonstandard Home installation locations and other ScanSnap models are not advertised by this V1 adapter.

Native identity is HMAC-derived with the existing per-workstation salt. Only an opaque ID, display name, manufacturer, model, USB connection, SCANSNAP backend and capabilities reach the signed device endpoint. Read-only execution of the actual adapter detected **ScanSnap iX500 / SCANSNAP / USB** on this workstation. This is detection evidence, not a physical scan PASS.

The provider/browser has no vendor dispatch. Optional generic capability metadata describes externally managed settings and capture instructions. The controls show the scanner as detected/untested, retain Test Scan and Scanner Settings, and explain the required external profile instead of offering driver controls the bridge cannot apply.

## Owner profile setup — not performed automatically

Create a new profile named **Trading Docks Cards** in ScanSnap Home. Do not overwrite an existing profile.

1. Select the iX500 and add a profile.
2. Use color, simplex, 300 DPI and JPEG image output. Disable OCR/PDF output for this workflow. Feed one card per capture; avoid multi-page or duplex output.
3. Use **PC (Scan to file)** and **None (Scan to file)** where offered. Enable **Save images with new file names after scanning** so the destination can be selected after each scan. Scan to Folder is an alternative when its destination dialog permits the exact filename and directory.
4. Configure crop only after checking it does not cut off card borders/text. The bridge cannot set or verify this driver setting.
5. During each requested capture, save exactly `capture.jpg` in the unique directory shown by the bridge. The local window has a Copy capture destination button; paste the complete path into the save dialog. Do not use the previous capture's path.

These controls follow the [official profile documentation](https://www.pfu.ricoh.com/imaging/downloads/manual/scansnap_help/en/pc/topic/ope_screen_profile_add.html). Their behavior on this installed Home/iX500 combination must be checked during physical acceptance. If Home cannot save to that exact destination, stop: no broad watch-folder workaround is enabled.

## Capture lifecycle and files

1. The existing authenticated, signed capture request selects an enumerated opaque device ID. The bridge assigns its capture ID; request and capture IDs must be UUIDs.
2. Create a fresh random directory under `%LOCALAPPDATA%\TradingDocks\ScannerBridgeState\captures`. Its name contains request ID, capture ID and another nonce. No directory is reused, including after restart/cancellation.
3. Show a local window: place one card in the feeder, press Scan on the iX500, and save to this capture's exact destination. The browser never supplies or receives a filesystem path.
4. Poll only that exact `capture.jpg`. Pre-existing files outside the new directory, other filenames/extensions, and late output in an earlier capture directory cannot satisfy the request. Wait for stable length/write time and exclusive access.
5. On Windows, validate path ancestry, reject reparse points and hard-linked input, compare the open handle's final path, enforce an 8 MiB input cap, JPEG signature/decoded format, and 20 megapixel limit. Re-encode without source metadata to JPEG, at most 2500 pixels on the longest edge and 8 MiB.
6. Deliver through the existing signed result endpoint with its capture ID. Test Scan previews only. Live Scan uses the same recognition/review/100-card queue and authoritative inventory writer as WIA.
7. Acknowledgement releases/clears the image buffer and deletes only this exact temporary file. Idempotent acknowledgement cannot rescan or redeliver it. Cancellation, failure, disconnect and expiry also attempt cleanup. Ready images expire after two minutes; pending requests cancel at 90 seconds.
8. A startup/minutely scavenger attempts cleanup of recognized capture directories older than three minutes. It never recurses, follows links, or deletes unexpected filenames. Locked files may persist until released and a later cleanup pass; a stopped/crashed bridge cannot enforce retention until restart. Cancelled output is never imported into a new request.

Deletion is ordinary filesystem deletion, **not** guaranteed forensic erasure on an SSD. ScanSnap Home may retain its own originals/history depending on the profile; the bridge does not inspect or delete vendor/user archives. Avoid archiving in Home for the acceptance profile. The bridge creates no image logs and exposes no directory browsing, arbitrary upload, executable or shell endpoint. Local Windows account/admin compromise remains outside this boundary.

## Limitations and physical acceptance gate

Direct programmatic acquisition is **NOT AVAILABLE in this build**. Physical-button scanning plus a manual destination save is implemented. Continuous Live Scan can request the next capture after acknowledgement, but each card still needs that save step. Unattended feeder throughput or a seamless vendor SDK loop is not claimed. Obtain the documented compatible SDK before pursuing that integration.

The bridge does not change Home profiles, press its UI controls, interrupt its feeder hardware, validate card authenticity, or know whether an operator saved the intended scan. Cancel suppresses delivery; it does not stop ScanSnap Home's scan. Detection does not guarantee the scanner is free, the lid is open, or paper is loaded. Incorrect filename/output format results in no accepted output and eventually timeout.

Owner acceptance remains required: select iX500, Test Scan one card, inspect preview/crop, ingest into a disposable Chaos batch, repeat, cancel/retry, test disconnect, then evaluate continuous/100-card ergonomics. Keep the model **PENDING_TEST**, not TESTED. No physical card was scanned by the agent.

## Local validation commands

Use the installed .NET 10 SDK explicitly if system `dotnet` resolves to an older SDK:

```powershell
dotnet run --project scanner-bridge/Tests
dotnet run --project scanner-bridge/WindowsTests
dotnet run --project scanner-bridge/WindowsTests -- --detect
npm run check
npx playwright test -c playwright.scanner-bridge.config.ts
npm run build
node scanner-bridge/audit.mjs
git diff --check
```

The Windows test executable uses synthetic JPEGs and read-only optional detection, not the installed bridge process. Core fixtures cover software/device absence, normalized detection, composite WIA routing, output, old/duplicate files, invalid image/size, cancellation/timeout and disconnect. Browser fixtures exercise signed pairing, generic external settings, waiting/output, preview, cancellation, resumed intake, plus the existing WIA 100-card isolated database commit. Fixture success must not be recorded as physical acceptance.

## Validation result — 2026-09-23

- Root checks: **999 tests PASS**, TypeScript PASS, ESLint PASS with existing warnings, dependency audit zero findings.
- Native core: **63 security/contract assertions PASS**, including unchanged authentication/replay boundaries and new backend tests.
- Windows native: synthetic JPEG validation/normalization, malformed/false-extension rejection and hard-link denial PASS. Composite read-only device enumeration detects the real connected iX500 without taking a scan.
- Browser: **5 scenarios PASS**, including generic external-settings capture coordination and existing 100-card intake/real commit RPC in a network-isolated disposable database. The first run was interrupted by navigation during concurrent visual inspection; rerun without that session passed. The separate visual check showed a populated Chaos workstation and no browser errors.
- Production build PASS; secret/artifact audit PASS; whitespace check PASS. No hosted deployment performed.
- Physical capture/preview/crop/continuous throughput: **PENDING**. Formal security review, code signing and public installer distribution remain pending.

Internal unsigned Windows x64 EXE (not installed by this task):

`scanner-bridge/artifacts/installer/TradingDocks.ScannerBridge.Setup-1.1.0-internal.exe`

SHA-256: `738684335D8D27DE6C260B6E968F11131DF6BC8D21C5C93A5D31F34A878BCE96`.

The original 1.0.0 installer is preserved locally as `TradingDocks.ScannerBridge.Setup-1.0.0-original.exe`, SHA-256 `B460922CB2C7C61274769B1A8A53A5DB50F3064B4D1DB8E6AB4084099FF4FDCD`. Generated installers/payloads remain ignored build outputs, not Git content. No installer is distributed publicly; no installed bridge process, trust certificate, profile, production gate, POS or Square configuration was changed. Stop here for owner-led local/staging physical acceptance.
