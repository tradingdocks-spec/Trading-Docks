# Card Shows Images and Offers — v89

## Included

- Card and sealed-product images in Card Shows search results
- Set name, collector/card number, rarity, game, and product type
- Larger image previews for faster printing verification
- Offer amount beside every condition and printing
- Automatic offer recalculation when the worker changes the buying percentage
- Separate saved buying percentages for singles and sealed products
- Blank offer values until the user enters a buying percentage
- Server-side image proxy with validation, timeouts, and caching
- Scryfall image support for Magic and TCGplayer product-image support for other games and sealed products

## Deployment

No new SQL or environment variable is required. Keep `JUSTTCG_API_KEY` configured
in the active Vercel project. Replace the matching files, commit, push, and
redeploy.
