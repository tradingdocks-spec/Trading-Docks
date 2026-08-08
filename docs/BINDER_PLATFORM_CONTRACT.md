# Binder Platform Contract

Status: Partially Implemented

## Canonical Ownership

Trading Docks must use one binder platform across Mobile, Headquarters, and public share links.

- Implemented: Shared TypeScript binder contracts live in `mobile/services/physical-binder.ts`.
- Implemented: Web imports the same contract through `src/lib/physical-binder.ts`.
- Implemented: The contract references the existing backend model: `portfolio_binders`, `portfolio_shares`, `inventory_locations`, and `inventory_items`.
- Partially Implemented: Current web portfolio sharing already uses portfolio share routes and tokens.
- Planned: Mobile binder creation, slot editing, and share-link UI need a dedicated product pass on top of this shared contract.

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
- Partially Implemented: Public web share routes exist today, but share-link unification still needs route-level product review before deprecating legacy binder-share paths.

## Contract Rules

1. Do not infer exact printing, quantity, condition, finish, or storage from card identity alone.
2. Do not create a separate mobile-only binder table.
3. Public share links must resolve from the same canonical backend model used by Headquarters.
4. Mobile may cache binder pages for UX, but Supabase remains authoritative for ownership and sharing.
5. Marketplace, messaging, and live trade negotiation are Planned and must not be implied by binder sharing.

## Open Decisions

- Planned: Finalize whether physical binder pages are represented entirely by `inventory_locations` metadata or by a dedicated reviewed binder-placement migration.
- Planned: Decide legacy `/share/binder/[token]` migration strategy after confirming active share traffic.
