TRADING DOCKS — DECK VAULT CARD IMAGE FIX

THE PROBLEM

The original sample Deck Vault cards contained names and analytics data, but
they did not contain saved image URLs. The visual Cards tab therefore rendered
the fallback title panel instead of actual Magic card images.

THE FIX

- Added /api/deck-vault/card-image
- Resolves each missing image by exact card name through Scryfall.
- Proxies and caches the card image for 24 hours.
- Existing imported cards still use their saved Scryfall image URL directly.
- Added lazy image loading.
- Added image error handling.
- Added visible card quantity overlays.
- Added Game Changer overlays.
- Added card price and type information beneath each image.
- Added thumbnails to compact list view.

ROUTE

/api/deck-vault/card-image?name=Atraxa%2C%20Praetors%27%20Voice

INSTALL

1. Extract into the project root.
2. Replace matching files.
3. Stop the development server.
4. Clear the Next.js cache:
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
5. Restart:
   npm run dev

The first load may take a moment while Scryfall images are resolved. Subsequent
loads are cached.
