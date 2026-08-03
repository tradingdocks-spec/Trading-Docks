# Trading Docks v221 — Mana Pool connection completion

## Fixed

- Saving a Mana Pool API key now marks the connection `ready`.
- The Marketplace Integration Center no longer shows `Setup required` after
  the key is successfully encrypted and saved.
- The saved-key input now displays a masked value such as
  `••••••••••••1234`.
- A dedicated **Replace saved key** workflow is included.
- A dedicated **Import from Mana Pool** button is included.
- Successful imports update `last_sync_at` and keep the connection ready.

## Server configuration

The import endpoint uses the encrypted saved credential and supports separately
configured official Mana Pool endpoints:

- `MANAPOOL_INVENTORY_IMPORT_URL`
- `MANAPOOL_ORDERS_IMPORT_URL`
- `MANAPOOL_PRICING_IMPORT_URL`

The URLs are intentionally environment variables because the authenticated Mana
Pool API documentation must be used as the source of truth. Trading Docks does
not invent undocumented endpoints.
