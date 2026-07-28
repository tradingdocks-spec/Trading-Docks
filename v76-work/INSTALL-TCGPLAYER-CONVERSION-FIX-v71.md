# Trading Docks TCGplayer Conversion Fix v71

This update fixes the misleading and blocked TCGplayer conversion workflow.

## Corrected behavior

- TCGCSV matches are now reported as product matches, not inventory SKU matches.
- The lookup button is labeled `Match products & prices`.
- Successful TCGCSV matches add product details and prices without pretending
  that condition-specific inventory IDs were returned.
- When rows are missing TCGplayer inventory SKU IDs, the primary button becomes
  `Download ManaBox bridge`.
- The bridge preserves name, printing, condition, language, finish, and
  quantity.
- After the user imports the bridge into ManaBox and exports TCGplayer inventory
  from ManaBox, uploading that file back into Trading Docks enables the normal
  TCGplayer CSV download automatically.
- A returned ManaBox/TCGplayer inventory export that already contains SKU IDs
  does not require the bridge again.

TCGCSV remains the source for product matching, set/product details, rarity,
images, and market/low pricing. TCGCSV does not publish the SKU layer that
combines product, language, printing, condition, and finish.

No new Supabase migration or environment variable is required.
