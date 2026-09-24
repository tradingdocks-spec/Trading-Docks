# Chaos Scan Albums and Automatic Inbox V2

Status: **Implemented and rehearsed locally; physical automatic capture pending.** Not approved for merge or deployment. Production settings, POS, Square and hardware certification are unchanged.

## Required workflow invariant

Every live batch accepts at most 100 physical captures. Recognition does not release capacity. Capture 100 pauses intake; 101 is refused and its local file preserved. Removing a reviewed card does not reuse a spent scanner slot. Already accepted recognition work finishes. Unresolved cards block commit.

The operator commits using the existing authoritative inventory writer, then sees **Print Batch Label** as the primary action. The label contains the exact committed batch code/ID, destination, initial physical quantity, UTC commit time and batch QR. The application does not pretend to know whether a printer succeeded: the operator confirms **Label printed and batch filed**. Only then is **Start Next 100** available. Confirmation creates a new UUID/code, optionally keeps the destination, retains pairing/device selection and starts the next scanner session at zero. Closed identity/intake records cannot be edited; legitimate later inventory movements can still update remaining batch stock.

## Local bridge 1.2.0

Inbox: `%LOCALAPPDATA%\TradingDocks\ScannerBridgeState\Inbox`, resolved through Windows LocalApplicationData. The bridge creates this directory. No browser-supplied filesystem paths are accepted. Signed, paired requests bind an explicit session to workspace, batch, destination, workstation and enumerated device. Existing HTTPS loopback, origins, ECDSA proof and replay guards remain in force.

Configure **Trading Docks Cards** once in ScanSnap Home: PC (Scan to file), automatic JPEG direct save with automatically unique filenames, color, 300 DPI, single-sided, one card/image. Set the permanent Inbox destination once; turn off rename/save prompts. Use crop only after physical inspection. Open **ScanSnap setup** in the bridge tray for guidance, then **Confirm ScanSnap profile configured** and refresh browser devices. Confirmation is operator attestation, not automated driver verification or certification.

Vendor documentation supports [direct save without the Home window](https://scansnap-faq.pfu.ricoh.com/hc/en-us/articles/23911336175129-How-do-I-save-scanned-images-to-a-specified-folder-without-displaying-the-main-window-of-ScanSnap-Home) and [profile editing](https://www.pfu.ricoh.com/imaging/downloads/manual/ss_webhelp/en/help/webhelp/topic/ope_profile_change_settings.html). No supported public profile-creation API was established. No private configuration reverse-engineering is used.

Stable polling tolerates duplicate/missed notifications. Old paths, reused paths, non-JPEG files, links, locked writes and invalid images cannot become normal captures. The existing Windows decoder checks final handle identity, links, signature, dimensions and size and strips image metadata. Request/capture IDs are idempotent. Full-batch overflow is not automatically imported by a new session; its presence is excluded by that session's baseline.

An unacknowledged ready image remains recoverable for the same pairing/session for up to 30 minutes while the bridge runs. **Recover pending capture** retries only that request, including at the cap. A persisted cloud-acknowledged receipt makes a lost local ACK idempotent. ACK deletes only the unchanged exact source file. Ordinary deletion is not forensic SSD erasure. Expiry/revocation clears image memory but preserves unacknowledged source files for explicit owner recovery. Process restart does not silently import them. Uninstall preserves Inbox files. ScanSnap's own archives are outside bridge control.

## Private cloud album

Forward migration: `20260923204804_chaos_scan_albums_v2.sql`. Applied only to disposable local rehearsal databases. It adds private bucket `chaos-scans`, album/capture metadata, bounded ordinal uniqueness, owner/current-workspace RLS, scoped insert/read Storage policies, `chaos_scan_command`, and album-backed immutability guards. It does not replay inventory/POS migrations or change authorization for ordinary inventory.

Object name: `{workspace_id}/{batch_id}/{capture_id}.jpg`. The bridge has no Supabase credentials. The normal authenticated application session authorizes a scoped server upload; there is no permanent upload URL or token handed to the bridge. Server decoding/normalization, reserve/upload/receive receipts and hash verification recover a lost upload response without creating a second object/card. Review results are saved to metadata. Source images are served through authenticated, private/no-store requests. Historical **View Scans** is read-only.

`CHAOS_SCAN_ALBUMS_V2=1` is required in addition to the existing owner/workspace Scanner Bridge gate. Default is off. No production environment variable has been changed. Cloud errors retain local sources and pause capture.

## Retention and deployment prerequisite

Committed albums expire after 30 days; authenticated source reads cease then. Unresolved/active albums never expire automatically. `scripts/chaos-scan-retention.mjs` defaults to dry-run and reports counts only. With `--execute`, it deletes exact expired CLOSED-album objects through Storage API before marking capture metadata EXPIRED. Album identity, recognition and inventory history remain intact. Failed cleanup is retryable.

Before any hosted enablement, configure and verify a daily trusted-server execution using explicit `CHAOS_RETENTION_SUPABASE_URL` and `CHAOS_RETENTION_SERVICE_ROLE_KEY`, plus failure monitoring. These credentials must never reach browser/bridge artifacts. No production scheduler or credentials were configured in this task. Enabling hosted albums without the verified cleanup job is **not ready**; access expiry alone is not object deletion.

## Validation and physical gate

- Native Inbox tests exercise 100 sequential image files, stable/incomplete writes, old/duplicate paths, response replay, malformed files, cap101, same-session recovery, disconnect/reconnect and ACK cleanup.
- Disposable Supabase-compatible DB tests exercise 100 captures/object metadata, authoritative commit, replay, label gate, new batch identity, current workspace, cross-tenant and anonymous denial.
- Browser rehearsal uses actual UI/routes/image normalization/RPC/RLS and a loopback Storage adapter storing real JPEG bytes. Transport to hosted Supabase Storage is **emulated**, not a real hosted Storage PASS. Native watcher and browser transport are separately tested; no physical scanner is simulated as tested hardware.
- A separate **real local Supabase Storage HTTP** rehearsal (`tests/chaos-scan-storage.mjs`, Storage v1.72.1, PostgreSQL 17) uploaded exactly 100 JPEG objects, retrieved the owner's source with matching checksum, and denied cross-tenant, anonymous, public-URL, overwrite and unreserved uploads. Database `chaos_storage_1790199351384`; internal Docker network only, no published service port. Temporary roles/credentials/service/network removed afterward; recovery container returned to disconnected networking. This is local service acceptance, not hosted deployment or physical acceptance.
- Browser flow checks 100 private sources, review, immutable commit, label confirmation, new batch, inherited location and connected scanner; interrupted response/reload recovery is a separate checkpoint within the flow.

Actual iX500 automatic capture remains **PENDING**. Install the private reviewed 1.2.0 candidate on the owner workstation, configure the profile once, run the local disposable acceptance app, pair, start Live Scan and press the physical Scan button for one card. Verify exactly one preview/album capture and no inventory commit. Stop for owner verification before more physical cards. Do not merge/deploy or claim TESTED until the required gates are accepted.

Rehearsal evidence: 1,001 root tests; 376 native security/contract assertions; Windows JPEG/invalid-image/hard-link validation and version identity; five existing bridge browser scenarios; V2 100-card browser flow including lost response/reload recovery; database `chaos_albums_1790198842500` with 100 committed units, immutable batch guards, cap/replay/label/security checks; TypeScript, lint (existing warnings), production build and secret audit. No hardware PASS is inferred from these results.

For the owner-only first capture checkpoint, run `tests/chaos-live-preview.mjs` with `NEXT_PUBLIC_SCANNER_BRIDGE_V1=1`, `CHAOS_SCAN_ALBUMS_V2=1`, `TD_PHYSICAL_CAPTURE=1`. It binds only `127.0.0.1:4320`, creates a new disposable fixture database, labels the UI explicitly, disables recognition rather than inventing an identification, and rejects inventory commit. No hosted credentials are read. Add exactly this local origin to the private bridge allowlist for this rehearsal, preserving approved origins and requiring normal pairing; remove it after acceptance. This checkpoint uses the local Storage adapter; real Storage transport was tested separately above.

## Internal candidate and current handoff

- Local artifact: `scanner-bridge/artifacts/installer/TradingDocks.ScannerBridge.Setup-1.2.0-internal.exe` (ignored build output; **not signed**, not distributed).
- Size: 180,050,200 bytes. SHA-256: `16F508BAAEEAB78F1C56E22663D56F7CF63891A87AA87B78F3F4DB1A85E2B00D`.
- Runtime/installer version: 1.2.0. Built from this branch's local working tree on base `69676456fea5ccf2612b119621aab9dcc98c53c7`; the assembly informational suffix identifies the base, not a committed V2 release.
- Original 1.1.0 artifacts preserved. No installation or Windows trust change was performed by this implementation task.
- Local acceptance page opened and visually inspected. Its commit route returned `Physical checkpoint: inventory commit disabled`; evidence remained zero captures/objects/inventory. Bridge was not reachable at the handoff.
- Local `origins.json` created with only the existing production origin and `http://127.0.0.1:4320`. This does not pair a browser or change the production account/workspace gate. Remove the local origin after the checkpoint. No trust/pairing material is in Git.
- Owner asked to install the candidate and configure the automatic profile before scanning. **Physical capture remains PENDING.**
