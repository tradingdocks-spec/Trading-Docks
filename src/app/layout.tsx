import type { Metadata, Viewport } from "next";

import { SignInEntrance } from "@/components/auth/SignInEntrance";
import { RouteEntrance } from "@/components/navigation/PolishedNavigation";
import "./globals.css";
import { ThemeProvider, ThemeCorner } from "@/components/theme/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL("https://www.tradingdocks.com"),
  applicationName: "Trading Docks",
  title: {
    default: "Trading Docks | Card Inventory, Pricing, and Operations OS",
    template: "%s | Trading Docks",
  },
  description:
    "Manage collections, inventory, pricing, labels, marketplace operations, and card-selling workflows from one connected Trading Docks workspace.",
  alternates: {
    canonical: "/",
  },
  keywords: [
    "Trading Docks",
    "card inventory software",
    "TCG inventory",
    "sports card inventory",
    "card store software",
    "card seller workspace",
  ],
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: "/",
    siteName: "Trading Docks",
    title: "Trading Docks | Card Inventory, Pricing, and Operations OS",
    description:
      "Manage collections, inventory, pricing, labels, marketplace operations, and card-selling workflows from one connected Trading Docks workspace.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Trading Docks | Card Inventory, Pricing, and Operations OS",
    description:
      "Manage collections, inventory, pricing, labels, marketplace operations, and card-selling workflows from one connected Trading Docks workspace.",
  },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};


export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a101b" },
    { media: "(prefers-color-scheme: light)", color: "#f3f7fd" },
  ],
};

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-td-canvas font-sans antialiased">
        <ThemeProvider>
          <ThemeCorner />
          <SignInEntrance />
          <RouteEntrance>{children}</RouteEntrance>
        </ThemeProvider>
      </body>
    </html>
  );
}

