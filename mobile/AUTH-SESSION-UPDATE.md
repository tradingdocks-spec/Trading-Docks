# Authentication and session update

This build adds:
- Responsive, centered desktop sign-in layout
- Remembered email preference
- Keep-me-signed-in preference
- Owner/Admin routing to `/admin` after authentication
- Native biometric enrollment preference (Face ID on iOS; biometrics on Android)
- Browser-safe session restoration

## Install
Run `npm install` after extracting. The project now includes `expo-local-authentication` and `expo-secure-store` for the next native biometric-lock implementation.

## Security behavior
Passwords are never written to local storage. Remembered email stores only the normalized email address. Biometric unlock is intended to protect a persisted Supabase session, not save the password.

## Face ID testing
Face ID is native-only and does not appear on Expo Web. Test it on an iPhone development build. Expo Go may not fully support Face ID permission strings; a development build is recommended.
