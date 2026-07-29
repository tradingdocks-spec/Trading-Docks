# Remember Me browser-restart fix — v99

This update keeps remembered Supabase sessions persistent across browser and
device restarts.

## Corrected behavior

- The remember-device preference is readable by both server and browser auth
  clients.
- Browser-side token rotation preserves the selected one-year cookie lifetime.
- The local device preference remains a fallback for users upgrading from v98.
- Closing and reopening the browser does not sign out a remembered session.
- Explicit Sign Out still revokes and clears the session.
- Passwords are never stored by Trading Docks.

## Verification

Sign in at `https://www.tradingdocks.com` with **Remember me on this device**
selected. Close every browser window without signing out, reopen the browser,
and return to the same address. The account should open without another login.
