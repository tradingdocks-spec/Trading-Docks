# PSA Slab Vault v182

The Collection area now includes a dedicated PSA Slab Vault.

- Add PSA-certified cards through a slab-specific intake flow.
- Track grade, certification number, year, set, card number, notes, cost, value, and storage location.
- Search by card, set, or certification number and filter by PSA grade.
- View slab count, collection value, cost basis, and unrealized gain.
- Slabs persist through the existing account-specific Supabase inventory storage.
- No new database migration is required.

Validation: TypeScript passed. The local full build remains blocked by the workspace's out-of-root `node_modules` symlink; Vercel installs dependencies normally from `package-lock.json`.
