# Binder Platform Contract

Status: Partially Implemented

## Canonical Ownership

Trading Docks must use one binder platform across Mobile, Headquarters, and public share links.

- Implemented: Shared TypeScript binder contracts live in `mobile/services/physical-binder.ts`.
- Implemented: Web imports the same contract through `src/lib/physical-binder.ts`.
- Implemented: The contract references the existing backend model: `portfolio_binders`, `portfolio_shares`, `inventory_locations`, and `inventory_items`.
- Implemented: Current web portfolio sharing uses portfolio share routes and tokens.
- Implemented: Mobile exposes a physical binder list, cover cards, page/spread pocket view, public share-link creation, native share/copy handoff, and share-link revocation against the same route and token contract.
- Partially Implemented: Mobile binder creation and slot editing still route through Storage Locations and Card Detail rather than a dedicated binder editor.

## Physical Binder Model

The shared model supports:

- Implemented: Binder identity, owner, visibility, cover metadata, rows, columns, page count, and trade-binder flag.
- Implemented: Page/spread projections with left and right pages.
- Implemented: Pocket labels such as `A1` through `C3`.
- Implemented: Placement validation that requires an owned inventory item, valid quantity, valid page, valid slot, and unoccupied pocket.
- Partially Implemented: Trade and Wishlist metadata are available through adjacent collection contracts, not duplicated inside the binder model.

## Sharing

- Implemented: Share request normalization supports binder, page, spread, and portfolio scopes.
- Implemented: Visibility supports private, unlisted, and public values.
- Implemented: Public web share routes render read-only binder/portfolio pages from canonical `portfolio_shares` tokens.
- Implemented: The share API accepts Headquarters cookie auth and mobile Supabase bearer auth, then writes owner-scoped share rows server-side.
- Partially Implemented: Share privacy is currently selected at link creation; an inline privacy toggle beyond revoke/regenerate remains future UX.

## Contract Rules

1. Do not infer exact printing, quantity, condition, finish, or storage from card identity alone.
2. Do not create a separate mobile-only binder table.
3. Public share links must resolve from the same canonical backend model used by Headquarters.
4. Mobile may cache binder pages for UX, but Supabase remains authoritative for ownership and sharing.
5. Marketplace, messaging, and live trade negotiation are Planned and must not be implied by binder sharing.

## Open Decisions

- Planned: Finalize whether physical binder pages are represented entirely by `inventory_locations` metadata or by a dedicated reviewed binder-placement migration.
- Planned: Decide legacy `/share/binder/[token]` migration strategy after confirming active share traffic.
