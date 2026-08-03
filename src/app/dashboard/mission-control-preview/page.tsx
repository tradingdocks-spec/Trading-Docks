import {
  SellerMissionControl,
  type MissionControlSnapshot,
} from "@/components/dashboard/mission-control/SellerMissionControl";

export const metadata = {
  title: "Mission Control Preview | Trading Docks",
};

export default function MissionControlPreviewPage() {
  const now = new Date();
  const lastSync = new Date(now.getTime() - 4 * 60 * 1000);

  const snapshot: MissionControlSnapshot = {
    businessName: "Trading Docks",
    ownerName: "Seller",
    inventoryUnits: 49821,
    inventoryRecords: 22640,
    connectedMarketplaces: [
      "TCGplayer",
      "eBay",
      "Mana Pool",
      "Shopify",
    ],
    orderCount: 284,
    openOrderCount: 7,
    revenue: 18426,
    profit: 6284,
    customerCount: 412,
    completedSyncCount: 96,
    failedSyncCount: 1,
    lastSyncAt: lastSync.toISOString(),
    readinessScore: 100,
    readinessComplete: 4,
    readinessTotal: 4,
    generatedAt: now.toISOString(),
  };

  return (
    <SellerMissionControl
      snapshot={snapshot}
      previewMode
    />
  );
}
