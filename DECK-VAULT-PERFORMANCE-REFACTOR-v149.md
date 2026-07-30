# Deck Vault Performance Refactor — v149

- Moved Showcase Studio and PNG export rendering into an on-demand client bundle.
- Kept the showcase bundle out of the normal Deck Detail loading path.
- Added an accessible loading state while the showcase bundle opens.
- Delayed automatic deck intelligence until editing has paused.
- Cancelled stale intelligence requests when a deck changes again.
- Added lazy loading and asynchronous decoding to noncritical deck images.
- Preserved eager loading for critical commander and mana imagery.
- Confirmed strict TypeScript validation with zero errors.

No Supabase migration is required.
