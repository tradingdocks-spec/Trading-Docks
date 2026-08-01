# Trading Docks v180 — Persistent Connected State

## Included

- Shows a green `Connected` badge on a marketplace after its email inbox is active.
- Removes the stale `Setup required` badge for that marketplace.
- Includes email-connected marketplaces in the connected-channel count.
- Restores the saved Gmail/Outlook and marketplace selections per workspace.
- Opens confirmed inboxes on the completed verification step after reload.
- Keeps `Manage connection` available so the setup can be reviewed or changed.

## Deployment

1. Run `00_RUN_THIS_IN_SUPABASE_EMAIL_CONNECTION_STATE.sql` once in Supabase SQL Editor.
2. Deploy the application.
3. Open Marketplace Integration Center and refresh Email Tracking status.

The existing workspace inbox remains unchanged. Existing mailboxes default to Gmail and TCGplayer, matching the current setup flow.
