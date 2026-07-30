# Vercel TypeScript Repair v148

This release completes a project-wide strict TypeScript repair for the Vercel
production build.

Fixed areas:

- Deck Vault persistence query row typing
- Inventory persistence query row typing
- eBay inventory and order import typing
- Saved eBay order identifier typing
- Settings account-tier normalization
- Tailwind merge type fallback

Validation:

- `tsc --noEmit` passes with zero errors
- No Supabase migration is required
