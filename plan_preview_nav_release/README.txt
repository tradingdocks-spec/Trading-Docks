TRADING DOCKS — LOCAL HOMEPAGE CARD IMAGES

The previous versions still depended on a Scryfall request while the website
was running. This version removes that dependency entirely.

The card images are downloaded one time into:

  public/market-cards/

The homepage then loads ordinary local files:

  /market-cards/mana-crypt.jpg
  /market-cards/force-of-will.jpg
  /market-cards/the-one-ring.jpg
  /market-cards/underground-sea.jpg

INSTALL

1. Extract this ZIP into the Trading Docks project root.

2. Run this command from the project root:

   node scripts/download-market-card-images.mjs

3. Confirm these files were created:

   public/market-cards/mana-crypt.jpg
   public/market-cards/force-of-will.jpg
   public/market-cards/the-one-ring.jpg
   public/market-cards/underground-sea.jpg

4. Confirm the homepage imports:

   import {
     LiveMarketIntelligence,
   } from "@/components/marketing/LiveMarketIntelligence";

5. Restart from a clean cache:

   Ctrl + C
   Remove-Item .next -Recurse -Force -ErrorAction SilentlyContinue
   npm run dev

WHY THIS SHOULD FIX IT

- No Scryfall image URL is used by the browser.
- No Next.js API image proxy is required.
- No remotePatterns configuration is required.
- No browser content-security exception is required.
- Images are served by localhost from the public directory.
- The component displays a designed placeholder instead of a broken-image icon
  if a local file is missing.

TEST

After running the downloader, open this directly:

  http://localhost:3000/market-cards/mana-crypt.jpg

If that URL shows Mana Crypt, the homepage component will show it as well.

If the local URL works but the homepage still shows the old broken image,
another older Live Market Intelligence component is being rendered. Search the
project for:

  Understand what is moving

and ensure the page imports the component included in this package.
