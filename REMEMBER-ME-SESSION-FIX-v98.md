# Trading Docks v98

## Remember Me correction

- Captures the submitted email directly from the login form so browser and
  mobile autofill cannot bypass the remembered-email behavior.
- Stores or removes the email only according to the user's checkbox selection.
- Applies the selected Remember Me lifetime to later browser-side Supabase
  refresh-token cookie writes.
- Preserves explicit Sign Out behavior.
- Never stores the user's password.

## Verification

- Next.js production build passed.
- TypeScript passed.
- All 72 application routes built successfully.
