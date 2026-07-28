# Trading Docks CSV Template Engine v69

This replaces the v68 converter with exact presets derived from the uploaded
sample files.

Supported source/output presets:

- TCG Archivist
- ManaBox
- CardSphere
- Card Kingdom
- MTGStocks
- MTGO
- MTG Manager
- MTGGoldfish
- Moxfield
- Helvault
- Dragon Shield
- Deck Builder
- Deckbox
- TCGplayer
- Trading Docks Universal

Condition and finish handling:

- Source values are normalized to TCGplayer-compatible conditions: Near Mint,
  Lightly Played, Moderately Played, Heavily Played, or Damaged.
- Finish is tracked independently as Nonfoil, Foil, or Etched.
- Formats with separate regular and foil quantity columns are split into
  separate inventory rows so foil copies are never merged with nonfoil copies.
- When a source omits condition or finish, the user can select explicit
  defaults before converting or saving inventory.

TCGplayer conversion uses a safe ManaBox bridge:

1. Upload any supported source and export it as ManaBox while preserving set,
   collector number, condition, language, finish, and quantity.
2. Import that file into ManaBox, then use ManaBox's TCGplayer export so
   TCGplayer assigns the required SKU-level `TCGplayer Id`.
3. Upload that ManaBox/TCGplayer export back into Trading Docks for review,
   inventory saving, or another conversion.

The optional `Resolve TCGplayer data` action uses TCGCSV to add the separate
TCGplayer product ID, product name, set name, collector number, rarity, image,
and current price fields. It never substitutes a product ID for the
SKU-level `TCGplayer Id`.

Direct TCGplayer download is blocked when any row is missing its SKU-level
`TCGplayer Id`, because TCGCSV does not publish condition/language/printing
SKU IDs. This prevents a plausible-looking but invalid TCGplayer upload.

No new Supabase migration or environment variable is required. TCGCSV requests
are made server-side through the existing cached TCGCSV client.
