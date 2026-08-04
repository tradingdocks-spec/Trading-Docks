# Expo Web Compatibility Fix

- Added an SSR-safe cross-platform storage adapter.
- Supabase Auth now uses browser localStorage on web and AsyncStorage on native.
- Replaced direct AsyncStorage usage in account, session, and offline queue services.
- Enabled URL session detection only on web.
- Moved deprecated pointerEvents props into style objects.
- Confirmed TypeScript, lint, and static Expo web export compatibility.
