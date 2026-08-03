# Trading Docks v219 — Mana Pool build fix

Fixed the Vercel TypeScript error in:

`src/components/dashboard/marketplaces/MarketplaceWorkspace.tsx`

The component used `CheckCircle2` for the saved-key confirmation badge but did
not import it from `lucide-react`.

This release adds the missing import and preserves the v218 Mana Pool API-key
save workflow.
