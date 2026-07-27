TRADING DOCKS — SEALED SEARCH CLEANUP V2

CHANGES

- Removed all truncation from Market, Suggested Cash, Expected Profit,
  Margin, and Inventory values.
- Currency values now use responsive font sizing and tabular numerals.
- Moved the three supporting metrics below the image/price area so each
  tile has more horizontal room.
- Product names can display naturally instead of being forcibly clamped.
- Increased label contrast and spacing.
- Slightly enlarged the Add button.
- Preserved the same TCGCSV search and appraisal calculations.

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev
