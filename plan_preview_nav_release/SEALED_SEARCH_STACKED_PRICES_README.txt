TRADING DOCKS — STACKED SEALED SEARCH PRICES

CHANGES

- Market and Suggested Cash now stack vertically.
- Each primary value receives the full card width.
- Large dollar amounts no longer collide or spill outside their tiles.
- Price text uses a fixed readable size with a smaller fallback for long values.
- Added overflow protection without truncating or adding ellipses.
- Moved the TCGCSV badge beneath the product title.
- Slightly reduced the search-result image width.
- Expected Profit, Margin, and Inventory remain in a three-column row.

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev
