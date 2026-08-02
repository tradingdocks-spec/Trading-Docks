import type { Metadata } from "next";

import { SignInEntrance } from "@/components/auth/SignInEntrance";
import { RouteEntrance } from "@/components/navigation/PolishedNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trading Docks",
    template: "%s | Trading Docks",
  },
  description:
    "Manage inventory, marketplace listings, pricing, and sales from one connected card-selling workspace.",
  manifest: "/site.webmanifest",
  themeColor: "#07121F",
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

type RootLayoutProps = Readonly<{
  children: React.ReactNode;
}>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#03080c] font-sans antialiased">
        <SignInEntrance />
        <RouteEntrance>{children}</RouteEntrance>
      </body>
    </html>
  );
}
