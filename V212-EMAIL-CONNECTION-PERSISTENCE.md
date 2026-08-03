# Trading Docks v212 — Persistent TCGplayer Email Connection

Fixed the disconnect between the active inbound mailbox and the Marketplace Integration Center.

- Active mailboxes now upsert TCGplayer as a ready email connection.
- Import processing persists the connection state.
- Refreshing or returning to Connections no longer shows Setup Required.
- The connection card shows Connected.
- The email setup header shows Receiving Active.
- Importing orders no longer reloads back into a stale setup state.
- Permanent mailbox behavior and duplicate-safe order imports remain intact.
