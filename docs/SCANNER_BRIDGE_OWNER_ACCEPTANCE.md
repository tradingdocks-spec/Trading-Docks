# Scanner Bridge owner-only physical acceptance

Status: Implemented scoped UI gate. Physical scanner certification, installer/trust acceptance, signing and formal security review remain PENDING.

The production build no longer uses `NEXT_PUBLIC_SCANNER_BRIDGE_V1` to enable a global UI. That variable is retained only for non-production local harnesses. Production access requires both server-only configuration values:

- `SCANNER_BRIDGE_ACCEPTANCE_USER_ID`: the one approved Auth user UUID.
- `SCANNER_BRIDGE_ACCEPTANCE_WORKSPACE_ID`: the one approved workspace UUID.

The Chaos Sort server page validates the authenticated user with `auth.getUser()` and queries the current active workspace, canonical `workspaces.owner_id`, and owner membership through the user's RLS-protected client. All must match. Missing configuration, anonymous users, other users/workspaces, delegated staff, changed ownership and query failures deny access. The allowlist is not in client metadata, URL parameters, local storage, or public environment variables. No schema/permissions/data changes are required.

The session proxy uses the same check for dashboard document CSP, adding only `https://127.0.0.1:47391` to `connect-src` for the approved owner. Dashboard documents are private/no-store. This also supports client navigation from Dashboard into Chaos Sort. Other users and public documents retain the default CSP without localhost. The server page independently checks access; it never trusts an incoming capability header. Workspace changes require the normal server navigation/refresh; the component remounts when its access boolean changes. Existing open documents are not remotely revoked: reload/close them after disabling acceptance.

The approved owner sees bridge health, Pair this workstation, scanner selection, Test Scan and Scanner Settings. Pairing is disabled until bridge health succeeds; selection is disabled until pairing, and settings/Test Scan until a device is selected. No pairing, scanner capture, installer action or inventory commit is automatic. The installer button remains disabled and no public download is added.

## Validation

- Sixteen gate/CSP tests cover owner allow, anonymous/other-owner denial, exact workspace, ownership transfer, delegated staff/admin/manager denial, missing configuration and database/network failure.
- Existing bridge E2E covers pairing, settings, test capture and 100-card authoritative commit only in an isolated synthetic rehearsal.
- Production verification must check the approved owner's controls without starting pairing, and confirm POS/Square remain disabled.

## Disable

Remove either server-only allowlist value and redeploy. Reload/close existing acceptance browser tabs. The UI and localhost CSP then return to disabled. Pairing trust is a separate local bridge/browser mechanism; the owner can explicitly unpair locally if desired. Do not enable POS, Square or promote hardware certification as part of this acceptance gate.
