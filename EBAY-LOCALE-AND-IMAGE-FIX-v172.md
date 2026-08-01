# eBay locale and image repair — v172

- Sends `Accept-Language: en-US` on eBay Sell API requests to prevent error 25709.
- Loads imported listing thumbnails through an authenticated Trading Docks image route.
- Restricts proxied images to eBay's official image CDN.
- Replaces failed thumbnails with a polished in-product fallback instead of a broken image icon.
- No Supabase migration is required.
