export type MarketingDemoFixture = { feature: string; state: string; label: string; dataSource: "synthetic_demo_state"; records: Record<string, unknown>[] };

const base = (feature: string, state: string, label: string, records: Record<string, unknown>[]): MarketingDemoFixture => ({ feature, state, label, dataSource: "synthetic_demo_state", records });

export const MARKETING_DEMO_FIXTURES: readonly MarketingDemoFixture[] = [
  base("chaos-sort", "primary", "Synthetic Chaos Sort intake", [{ batchLabel: "Demo intake · 2026-09-01", cards: 24, status: "review", locations: 3 }, { cardLabel: "Demo card A", identity: "Recognized", position: "Shelf A / Bin 02" }]),
  base("chaos-sort", "workflow", "Chaos Sort workflow", [{ step: "scan", status: "complete" }, { step: "identify", status: "in_progress" }, { step: "confirm", status: "next" }, { step: "locate", status: "queued" }]),
  base("chaos-sort", "inventory-result", "Inventory result", [{ cards: 5, status: "located", positions: ["Shelf A / Bin 02", "Shelf B / Bin 04"] }]),
  base("chaos-sort", "locations", "Synthetic location assignment", [{ batchLabel: "Demo batch 001", status: "active", positions: ["Shelf A / Bin 02", "Shelf B / Bin 04"] }]),
  base("chaos-sort", "review", "Synthetic recognition review", [{ cardLabel: "Demo card B", confidence: "review", decision: "pending" }]),
  base("inventory", "locations", "Synthetic inventory locations", [{ cardLabel: "Demo card C", batch: "Demo batch 001", location: "Shelf A / Bin 02", quantity: 1 }, { cardLabel: "Demo card D", batch: "Demo batch 002", location: "Shelf B / Bin 04", quantity: 2 }]),
  base("inventory", "provenance", "Synthetic batch provenance", [{ cardLabel: "Demo card E", batch: "Demo batch 003", events: ["received", "identified", "located"] }]),
  base("orders", "pick-pack", "Synthetic order fulfillment", [{ orderLabel: "Demo order 001", status: "picking", items: 3 }, { orderLabel: "Demo order 002", status: "packed", items: 1 }]),
  base("analytics", "overview", "Synthetic demo metrics", [{ metric: "Demo inventory items", value: 128 }, { metric: "Demo orders", value: 14 }, { metric: "Demo period", value: "Internal fixture" }]),
  base("collection-buying", "intake", "Synthetic collection intake", [{ collectionLabel: "Demo collection A", status: "review", cards: 42 }]),
  base("tournaments", "event", "Synthetic tournament operations", [{ eventLabel: "Demo weekly event", round: 2, registrations: 16 }]),
  base("showcase", "kiosk", "Synthetic showcase display", [{ displayLabel: "Demo showcase", items: 8, status: "ready" }]),
  base("marketplaces", "connections", "Synthetic marketplace connections", [{ channel: "Demo marketplace", status: "connected", listings: 12 }]),
];

export function getMarketingDemoFixture(feature: string, state: string) {
  return MARKETING_DEMO_FIXTURES.find((fixture) => fixture.feature === feature && fixture.state === state) ?? null;
}
