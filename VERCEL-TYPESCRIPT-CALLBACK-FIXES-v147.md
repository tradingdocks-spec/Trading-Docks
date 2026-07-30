# Vercel TypeScript callback fixes — v147

- Replaced the implicitly typed Supabase attachment callback in
  `AdminFeedbackQueue.tsx` with an awaited query.
- Replaced the remaining destructured Supabase promise callback in
  `MarketplaceWorkspace.tsx` with an awaited query.
- Scanned the TypeScript source for the same destructured `.then(...)` pattern;
  no remaining matches were found.
- No Supabase migration is required.
