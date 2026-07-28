TRADING DOCKS — SIMPLIFIED SEALED PRODUCT SEARCH

The quick search cards now display:

- Market Price
- Suggested Cash Offer
- Expected Profit
- Expected Margin
- Inventory Owned
- Product image and name
- Product type and game
- Dedicated Add button

TCG Low and Direct Low were removed from the quick search cards to reduce
visual clutter. Those values remain in the TCGCSV data layer and in the
detailed appraisal section for future calculations and reporting.

The quick profit preview currently assumes:

- 13.25% marketplace fees
- $12.00 shipping
- The cash-offer percentage selected in the buying controls

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev
