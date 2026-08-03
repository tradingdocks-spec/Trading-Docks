# Trading Docks v213 — Vercel TypeScript build fix

Fixed the missing `setImportAddressStatus` prop in
`MarketplaceWorkspace.tsx`.

The callback is now wired through:
- the `EmailImportSetup` render call
- the component argument list
- the prop type definition

All v212 TCGplayer connection-persistence behavior remains preserved.
