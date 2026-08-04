# Trading Docks Mobile — Phase 1 Foundation

This build contains real, navigable Expo Router screens for:

- Premium landing page
- Welcome / entry choice
- Account-type onboarding (Free, Collector, Seller, Store)
- Email sign in and sign up with Supabase
- Google and Apple OAuth entry points through Supabase
- Membership selection and subscription checkout UI
- Account-aware mobile tab navigation
- Profile and sign-out flow
- Seller / Store Deal Desk preview route

## Preview the flow

1. Run `npm install`
2. Run `npx expo start --clear`
3. From the premium landing page, tap **Get Started Free**
4. Choose **Choose account and get started**
5. Select an account type
6. Continue through account creation and membership screens

The subscription screen is a working UI foundation. Real App Store / Google Play billing still requires RevenueCat or native store billing credentials and product IDs.

## Supabase setup

Set these values in `.env`:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Enable Google and Apple providers in Supabase Auth and add the Expo redirect URL used by the app.
