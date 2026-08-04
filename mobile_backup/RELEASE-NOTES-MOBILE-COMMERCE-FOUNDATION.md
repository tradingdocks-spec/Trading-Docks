# Trading Docks Mobile — Commerce Foundation

## Added
- Account-type onboarding for Free, Collector, Seller, and Store users.
- Account-aware bottom navigation.
- Seller/Store Deal Desk with Buy, Trade, Sealed, and Show modes.
- Live buying-percentage and budget calculations.
- Social sign-in buttons for Google and Apple using Supabase OAuth.
- Membership selection and mobile subscription/paywall screen.
- Persistent account-type selection through AsyncStorage.
- Membership management entry in Profile.

## External setup still required
1. Enable Google and Apple providers in Supabase Auth.
2. Add `tradingdocks://auth/callback` to Supabase redirect URLs.
3. Configure Google OAuth credentials and Apple Services ID / keys.
4. Create App Store Connect and Google Play subscription products.
5. Connect those products through RevenueCat, then replace the temporary purchase alert in `app/plans.tsx` with the RevenueCat purchase call.

The UI and product architecture are ready, but real social-provider authentication and real store billing cannot be activated without the project-owner credentials and store product IDs.
