import type { Metadata } from "next";

import { RouteEntrance } from "@/components/navigation/PolishedNavigation";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Trading Docks",
    template: "%s | Trading Docks",
  },
  description:
    "Manage inventory, marketplace listings, pricing, and sales from one connected card-selling workspace.",
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
        <RouteEntrance>{children}</RouteEntrance>
      </body>
    </html>
  );
}
