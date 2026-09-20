import type { NextConfig } from "next";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://maps.googleapis.com https://maps.gstatic.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co https://api.scryfall.com https://cards.scryfall.io https://cdn.tcgtracking.com https://tcgplayer-cdn.tcgplayer.com https://product-images.tcgplayer.com https://maps.googleapis.com https://maps.gstatic.com",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.scryfall.com https://api2.moxfield.com https://maps.googleapis.com https://maps.gstatic.com",
  "upgrade-insecure-requests",
].join("; ");

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=()" },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "Cross-Origin-Resource-Policy", value: "same-site" },
        ],
      },
    ];
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.pokemontcg.io", pathname: "/**" },
      { protocol: "https", hostname: "assets.tcgdex.net", pathname: "/ja/**" },
      { protocol: "https", hostname: "cards.lorcast.io", pathname: "/card/digital/**" },
      { protocol: "https", hostname: "optcgapi.com", pathname: "/media/static/Card_Images/**" },
      {
        protocol: "https",
        hostname: "api.scryfall.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "cards.scryfall.io",
        pathname: "/**",
      },
      { protocol: "https", hostname: "cdn.tcgtracking.com", pathname: "/**" },
      { protocol: "https", hostname: "tcgplayer-cdn.tcgplayer.com", pathname: "/**" },
      { protocol: "https", hostname: "product-images.tcgplayer.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
