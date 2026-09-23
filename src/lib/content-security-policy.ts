export function contentSecurityPolicy(scannerBridgeEnabled = false) { return [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://api.scryfall.com https://cards.scryfall.io https://cdn.tcgtracking.com https://tcgplayer-cdn.tcgplayer.com https://product-images.tcgplayer.com https://maps.googleapis.com https://maps.gstatic.com https://www.zebra.com https://mediaserver.goepson.com https://images.ctfassets.net",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.scryfall.com https://api2.moxfield.com https://maps.googleapis.com https://maps.gstatic.com" + (scannerBridgeEnabled ? " https://127.0.0.1:47391" : ""),
  "upgrade-insecure-requests",
].join("; "); }
