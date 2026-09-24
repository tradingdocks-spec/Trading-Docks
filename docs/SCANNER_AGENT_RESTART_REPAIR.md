# Scanner Agent 1.3.1 local restart repair

Status: local repair implemented; no website deployment or database change.

## Diagnosis

On 2026-09-24 the retained 1.3.0 process (PID 69804, started 17:36:20 UTC) had no listening socket and no tray icon. `dotnet-stack report` showed the UI thread blocked in `TaskAwaiter.HandleNonSuccessAndDebuggerNotification -> BridgeTray.ExitThreadCore -> Application.Exit -> Application.Restart`. Restart never reached process relaunch. Shutdown had already removed the tray and stopped accepting HTTPS connections. This was a synchronous shutdown deadlock, not a startup certificate exception or competing port owner.

The installed path was `%LOCALAPPDATA%/Programs/TradingDocksScannerBridge/TradingDocks.ScannerBridge.exe`. The preserved TLS certificate reference was valid, trusted in CurrentUser Root, and its private key successfully signed a local probe. Four configured exact origins included production. The old build cleared host logging providers and had no lifecycle file; the live thread stack supplied the failure evidence.

## Repair

Host start/stop execute on the thread pool without capturing the WinForms synchronization context. Restart exits the message loop, releases the singleton mutex, and only then launches the exact executable with its installation directory. Local lifecycle logging records startup, configuration/certificate thumbprint, listener/tray readiness, shutdown, and relaunch; no credentials or capture contents are logged. Version is consistently 1.3.1. No pairing or trust reset.

## Validation

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
