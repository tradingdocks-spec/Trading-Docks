# Permanent inbound email behavior

Every workspace receives one address, created once and stored in Supabase.

The address does not change when:
- the user signs out or back in
- the page reloads
- the application is redeployed
- Gmail/Outlook is changed
- a marketplace selection is changed
- a new version of Trading Docks is installed

Rotation is available only through the protected DELETE endpoint and requires
the exact confirmation value `ROTATE`. Existing forwarding rules must be updated
after any explicit rotation.

To restore the original Trading Docks address, run:
`00_RUN_THIS_IN_SUPABASE_RESTORE_PERMANENT_EMAIL.sql`
