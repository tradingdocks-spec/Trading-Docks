# Scanner Agent 1.3.1 local restart repair

Status: lifecycle repair implemented; production promotion validation below. No website or database changes are included.

## Diagnosis

On 2026-09-24 the retained 1.3.0 process (PID 69804, started 17:36:20 UTC) had no listening socket and no tray icon. `dotnet-stack report` showed the UI thread blocked in `TaskAwaiter.HandleNonSuccessAndDebuggerNotification -> BridgeTray.ExitThreadCore -> Application.Exit -> Application.Restart`. Restart never reached process relaunch. Shutdown had already removed the tray and stopped accepting HTTPS connections. This was a synchronous shutdown deadlock, not a startup certificate exception or competing port owner.

The installed path was `%LOCALAPPDATA%/Programs/TradingDocksScannerBridge/TradingDocks.ScannerBridge.exe`. The preserved TLS certificate reference was valid, trusted in CurrentUser Root, and its private key successfully signed a local probe. Four configured exact origins included production. The old build cleared host logging providers and had no lifecycle file; the live thread stack supplied the failure evidence.

## Repair

Host start/stop execute on the thread pool without capturing the WinForms synchronization context. Restart exits the message loop, releases the singleton mutex, and only then launches the exact executable with its installation directory. Local lifecycle logging records startup, configuration/certificate thumbprint, listener/tray readiness, shutdown, and relaunch; no credentials or capture contents are logged. Version is consistently 1.3.1. No pairing or trust reset.

## Historical private-build validation

- 403 native security/contract assertions pass.
- Windows tests pass: blocked synchronization-context regression, exact restart executable/directory, version consistency, DPAPI recovery, image/path protection.
- Local internal signatures valid; secret audit and diff check pass.
- State and old installation backed up outside Git before terminating the verified deadlocked process.
- Installed 1.3.1 PID 71988 bound only `127.0.0.1:47391`; trusted HTTPS health returned 1.3.1 with no recovery error.
- Actual loaded TLS thumbprint: `B6009C5248CCD5FB3EBD837D8DF7A4B2E84C68C6`.
- Lifecycle log recorded listener startup and tray visibility. Original state-file hashes matched the backup.
- Unauthenticated status returns 401; unapproved-origin health returns 403.
- Full user tray restart / relaunch / automatic Chrome reconnection checkpoint remains pending observation.
- Normal Chrome automatically reached the restored agent after its tab became visible. Its state changed from disconnected to "Needs setup — pair this computer". This establishes HTTPS reachability, not restored browser pairing; no re-pair was attempted. CS-000023 remained at 0/100 with UC Bulk Boxes selected.

The private installer and backup remain outside Git. No scanning, inventory mutation, production deployment, schema change, or POS/Square configuration was performed. Hardware certification remains pending.

## Controlled source promotion (2026-09-24)

The owner approved only the lifecycle/restart repair from `d6469de`. The clean promotion branch starts at `c3cadf0d` on main. Main's native agent was still 1.2.0; the private 1.3.0 capture authorization/recovery implementation was not imported. Conflicts were resolved by retaining main's existing `BridgeHost.Create` arguments and capture/security construction, applying the reviewed lifecycle hunks, and updating the runtime/Windows/installer version to 1.3.1. No installed agent was replaced or restarted.

Exactly seven files: this report; `Core/Protocol.cs`; `Installer/Installer.csproj`; `Windows/AgentLifecycle.cs`; `Windows/Program.cs`; `Windows/Windows.csproj`; `WindowsTests/Program.cs` (all code paths under `scanner-bridge/`). No website, inventory/schema, TWAIN, orientation, recognition, or unrelated Chaos files are included.

Fresh clean-branch validation:

- Native suite: **376 security/contract assertions passed**, including HTTPS loopback, pairing/origin/signature/replay protections and synthetic capture behavior. No OS trust store changed.
- Windows suite: **5 checks passed**, covering blocked UI synchronization context, exact relaunch executable/directory, version consistency, image validation, and hard-link protection. No scanner enumeration or physical capture requested.
- Release Windows app and self-contained internal installer builds passed using the existing local .NET 10 SDK. Generated binaries/payload are ignored and were not committed, installed, signed for distribution, or published.
- The 403-assertion private-build result above is historical evidence from a different baseline; it is not the clean-branch test total.
- GitHub CI is a separate merge gate. Physical tray/Chrome/Windows-restart acceptance remains pending; source promotion does not certify hardware or authorize installer distribution.
