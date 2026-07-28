# Trading Docks authentication setup

The application code includes email/password sign-in, password recovery, and
Google sign-in. Complete these provider settings in Supabase before testing.

## URL configuration

In **Supabase → Authentication → URL Configuration**:

- Set the production Site URL to the final Trading Docks domain.
- Add `http://localhost:3000/auth/callback` to Redirect URLs for local testing.
- Add `https://YOUR-DOMAIN/auth/callback` to Redirect URLs for production.

## Password recovery

In **Authentication → Email Templates → Reset password**, keep the Supabase
confirmation URL variable in the button/link. The application passes
`/auth/callback?next=/update-password` as the redirect target.

For local testing, request a new link after changing URL settings. Previously
issued links can remain invalid or point to an older origin.

## Google provider

1. In Google Cloud, create an OAuth 2.0 Web application.
2. Copy the Supabase Google callback URL shown under
   **Authentication → Providers → Google** into Google's Authorized redirect
   URIs. This is the Supabase `/auth/v1/callback` URL, not the app callback.
3. Add the local and production Trading Docks origins to Google's Authorized
   JavaScript origins.
4. Paste the Google Client ID and Client Secret into the Supabase Google
   provider and enable it.
5. Keep automatic identity linking enabled only if your authentication policy
   permits verified identities with the same email to share one account.

Never place the Google Client Secret in `.env.local` or browser code.
