import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: {
    default: "Trading Docks",
    template: "%s | Trading Docks",
  },
  description:
    "Professional tools for collectors, players, sellers, and game stores.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#030C18",
};

