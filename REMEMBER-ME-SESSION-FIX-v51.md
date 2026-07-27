# Remember Me session fix

The authentication cookie policy now preserves Supabase refresh-token rotation
and deletion instructions.

Previously, `Max-Age=0` cookie removals were overwritten with a new 30-day
expiration whenever Remember Me was selected. That left an invalid refresh
token in the browser and caused `refresh_token_not_found` after restarting the
browser.

Current behavior:

- Checked: valid Supabase session cookies persist for 30 days.
- Unchecked: valid Supabase session cookies remain browser-session cookies.
- Rotated, expired, invalid, and signed-out cookies are deleted immediately.
- Signing out also clears the Remember Me preference.

After installing this release, clear site data for `localhost:3000` once to
remove any invalid token left by an earlier build, then sign in again with
Remember Me selected.
