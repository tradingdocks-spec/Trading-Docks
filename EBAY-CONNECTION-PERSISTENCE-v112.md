# eBay connection persistence — v112

This update keeps the saved credential and OAuth connection state consistent
after the user closes and reopens Trading Docks.

## Changes

- The eBay OAuth callback preserves `credentials_saved` when authorization
  succeeds.
- Successful authorization records a healthy, read-only connection.
- Saved credential forms stay collapsed on later visits.
- Credential fields appear only after the user chooses **Replace saved
  credentials**.
- Authorized accounts show **Reconnect eBay account** instead of prompting for
  setup again.
- Returning from eBay displays a clear connected confirmation.

No new database migration or environment variable is required for v112.

After deployment, authorize eBay one final time so the corrected callback can
repair the existing connection record. The encrypted credentials themselves do
not need to be entered again unless the encryption key or eBay developer
credentials changed.
