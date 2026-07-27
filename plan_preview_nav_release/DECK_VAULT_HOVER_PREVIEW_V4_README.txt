TRADING DOCKS — DECK VAULT HOVER PREVIEW V4

CHANGES

- Removed the large View and Remove buttons from card artwork.
- Hovering a card now enlarges the card image by approximately 24%.
- Hover preview uses a raised z-index so it appears above nearby cards.
- Added a premium shadow and border treatment during hover.
- Added an unobtrusive circular X button in the upper-right corner.
- The remove control is hidden until hover.
- Hovering reveals card name, type, and price over a soft gradient.
- Quantity and Game Changer badges remain visible.
- Standalone commander presentation is unchanged.
- Card layout remains stable while the enlarged preview floats above it.

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev
