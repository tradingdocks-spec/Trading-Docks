import type { NextConfig } from "next";

import { contentSecurityPolicy } from "./src/lib/content-security-policy";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@sparticuz/chromium", "puppeteer-core"],
  outputFileTracingIncludes: {
    "/api/admin/marketing/autopilot": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/admin/marketing/autopilot/health": ["./node_modules/@sparticuz/chromium/bin/**/*"],
    "/api/admin/marketing/intelligence/capture": ["./node_modules/@sparticuz/chromium/bin/**/*"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: contentSecurityPolicy(process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_SCANNER_BRIDGE_V1 === "1") },
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
