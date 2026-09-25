import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildBusinessCommandCenterSummary,
  canViewBusinessCommandCenter,
  canViewStoreOperations,
  getBusinessDateWindow,
} from "../src/lib/dashboard/business-command-center.ts";
import {
  buildExecutiveBrief,
  buildRankedActions,
  buildTradingDocksSignals,
  calculateInventoryAttribution,
  calculateInventoryCapital,
  calculateProfitConfidence,
} from "../src/lib/dashboard/intelligence/business-intelligence.ts";
import {
  filterOrdersByCanonicalDateRange,
  summarizeCanonicalOrders,
} from "../src/lib/orders/order-metrics.ts";
import {
  clientAccessFromTier,
  resolvePlatformAccessContext,
  type PlatformAccessContext,
} from "../mobile/services/platform-access.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function access(input: {
  tier?: string;
  platformRole?: "owner" | "admin" | "support" | "analyst" | "user";
  workspaceRole?: "owner" | "admin" | "manager" | "member" | "viewer" | null;
  workspaceId?: string | null;
} = {}) {
  return resolvePlatformAccessContext({
    userId: "user-1",
    authenticated: true,
    platformRole: input.platformRole ?? "user",
    platformRoleAuthority: input.platformRole && input.platformRole !== "user" ? "trusted" : "client",
    accountType: input.tier ?? "free",
    effectiveMembershipTier: input.tier ?? "free",
    workspaceRole: input.workspaceRole ?? null,
    workspaceId: input.workspaceId ?? "workspace-1",
  });
}

test("business command center access follows effective capabilities rather than raw billing tier", () => {
  const free = access({ tier: "free" });
  const collector = access({ tier: "collector" });
  const seller = access({ tier: "seller" });
  const store = access({ tier: "store", workspaceRole: "manager" });
  const ownerFree = access({ tier: "free", platformRole: "owner" });
  const adminFree = access({ tier: "free", platformRole: "admin" });

  assert.equal(canViewBusinessCommandCenter(free), false);
  assert.equal(canViewBusinessCommandCenter(collector), false);
  assert.equal(canViewBusinessCommandCenter(seller), true);
  assert.equal(canViewStoreOperations(seller), false);
  assert.equal(canViewBusinessCommandCenter(store), true);
  assert.equal(canViewStoreOperations(store), true);
  assert.equal(canViewBusinessCommandCenter(ownerFree), true);
  assert.equal(canViewStoreOperations(ownerFree), true);
  assert.equal(canViewBusinessCommandCenter(adminFree), true);
  assert.equal(canViewStoreOperations(adminFree), true);
});

test("client manipulation cannot create Owner business command-center access", () => {
  const manipulated = clientAccessFromTier("free", {
    platformRole: "owner",
    workspaceRole: "owner",
  });

  assert.equal(manipulated.platformRole, "user");
  assert.equal(manipulated.platformRoleAuthority, "client");
  assert.equal(canViewBusinessCommandCenter(manipulated as PlatformAccessContext), false);
});

test("seller summary uses real user-scoped order and item rows", () => {
  const summary = buildBusinessCommandCenterSummary({
    access: access({ tier: "seller" }),
    now: new Date("2026-08-10T16:00:00.000Z"),
    orders: [
      {
        id: "order-1",
        marketplace_id: "TCGPlayer",
        total: 100,
        cost_of_goods: 58,
        net_profit: 42,
        normalized_status: "new",
        marketplace_order_items: [{ marketplace_order_id: "order-1", quantity: 2, inventory_item_id: "item-1", match_status: "matched" }],
      },
      {
        id: "order-2",
        marketplace_id: "eBay",
        total: "50.50",
        cost_of_goods: 40.25,
        net_profit: "10.25",
        normalized_status: "shipped",
        marketplace_order_items: [{ marketplace_order_id: "order-2", quantity: "3", match_status: "unmatched" }],
      },
    ],
    previousOrders: [{ id: "prior-1", marketplace_id: "tcgplayer", total: 75 }],
    connections: [{ marketplace_id: "tcgplayer", status: "ready" }],
    syncRuns: [{ marketplace_id: "tcgplayer", status: "failed" }],
  });

  assert.equal(summary.grossSales, 150.5);
  assert.equal(summary.orderCount, 2);
  assert.equal(summary.itemsSold, 5);
  assert.equal(summary.averageOrderValue, 75.25);
  assert.equal(summary.realizedProfit, 52.25);
  assert.equal(summary.profitKnownUnits, 5);
  assert.equal(summary.profitTotalUnits, 5);
  assert.equal(summary.profitCoverageRatio, 1);
  assert.equal(summary.openFulfillmentCount, 1);
  assert.equal(summary.listingIssues, 1);
  assert.equal(summary.syncIssues, 1);
  assert.equal(summary.inventoryAttribution.coveragePercent, 50);
  assert.equal(summary.profitConfidence.level, "Medium");
  assert.ok(summary.docksBrief.includes("orders generated"));
  assert.equal(summary.channelBreakdown.find((channel) => channel.id === "tcgplayer")?.grossSales, 100);
  assert.equal(summary.channelBreakdown.find((channel) => channel.id === "ebay")?.grossSales, 50.5);
});

test("executive brief explains revenue decline only when real metrics support it", () => {
  const brief = buildExecutiveBrief({
    rangeLabel: "Last 7 days",
    grossSales: 173,
    previousGrossSales: 181,
    salesChangePercent: -4.419,
    orderCount: 25,
    previousOrderCount: 22,
    averageOrderValue: 6.92,
    previousAverageOrderValue: 8.23,
    connectedChannelCount: 2,
  });

  assert.equal(brief.headline, "Sales softened 4.4%, but order volume increased.");
  assert.equal(brief.explanation, "Lower average order value, not lower order volume, drove the revenue decline.");
  assert.match(brief.metricsLine, /\$173 revenue · 25 orders · \$7 AOV · 2 active channels/);
});

test("inventory attribution and profit confidence expose coverage instead of fake certainty", () => {
  const orders = [
    {
      id: "matched",
      marketplace_order_items: [
        { quantity: 2, inventory_item_id: "item-1", match_status: "matched" },
        { quantity: 1, inventory_item_id: "item-2", match_status: "matched" },
      ],
    },
    {
      id: "unmatched",
      marketplace_order_items: [
        { quantity: 3, match_status: "unmatched" },
      ],
    },
  ];
  const attribution = calculateInventoryAttribution(orders);
  const confidence = calculateProfitConfidence(orders, attribution);

  assert.equal(attribution.matchedOrderCount, 1);
  assert.equal(attribution.totalOrderCount, 2);
  assert.equal(attribution.unmatchedLineCount, 1);
  assert.equal(attribution.coveragePercent, 66.66666666666666);
  assert.equal(confidence.matchedSoldUnits, 3);
  assert.equal(confidence.totalSoldUnits, 6);
  assert.equal(confidence.level, "Medium");
  assert.match(confidence.reason, /50% of sold units/);
});

test("capital at risk uses explicit stale inventory threshold and value coverage", () => {
  const capital = calculateInventoryCapital({
    now: new Date("2026-08-14T12:00:00.000Z"),
    inventoryRows: [
      { id: "listed", inventory_value: 200, data: {inventoryValueSemantics:"total_row_v1"}, updated_at: "2026-08-01T12:00:00.000Z" },
      { id: "stale", inventory_value: 842, data: {inventoryValueSemantics:"total_row_v1"}, updated_at: "2026-04-01T12:00:00.000Z" },
      { id: "unvalued", inventory_value: 0, updated_at: "2026-03-01T12:00:00.000Z" },
    ],
    listingRows: [{ inventory_item_id: "listed", match_status: "matched" }],
  });

  assert.equal(capital.totalValue, 1042);
  assert.equal(capital.listedValue, 200);
  assert.equal(capital.unlistedValue, 842);
  assert.equal(capital.staleValue, 842);
  assert.equal(capital.staleItemCount, 1);
  assert.equal(capital.staleThresholdDays, 90);
  assert.equal(Math.round(capital.coveragePercent), 67);
});

test("Trading Docks signals and next actions are evidence-ranked without fabricated AI scores", () => {
  const attribution = {
    coveragePercent: 0,
    matchedOrderCount: 0,
    totalOrderCount: 3,
    matchedLineCount: 0,
    totalLineCount: 4,
    unmatchedLineCount: 4,
    reason: "0 of 3 orders have complete inventory attribution.",
  };
  const inventoryCapital = {
    totalValue: 1400,
    listedValue: 300,
    unlistedValue: 1100,
    staleValue: 1240,
    staleItemCount: 14,
    staleThresholdDays: 90,
    coveragePercent: 84,
  };
  const signals = buildTradingDocksSignals({
    openFulfillmentCount: 9,
    listingIssues: 4,
    repricingReviewCount: 14,
    syncIssues: 1,
    inventoryCapital,
    inventoryAttribution: attribution,
    orders: [
      { id: "one", marketplace_order_items: [{ title: "Fast SKU", quantity: 2, match_status: "unmatched" }] },
    ],
  });
  const actions = buildRankedActions({
    signals,
    connectedChannelCount: 1,
    hasStoreAccess: false,
    employeeCount: null,
    vendorCount: null,
    supplyAlertCount: null,
  });

  assert.equal(signals[0].id, "sync-issues");
  assert.ok(signals.some((signal) => signal.id === "inventory-attribution-gap"));
  assert.ok(signals.some((signal) => signal.id === "capital-at-risk"));
  assert.equal(actions[0].id, "sync-issues");
  assert.doesNotMatch(JSON.stringify(signals), /ai score/i);
});

test("current-week date window includes the full Aug 10 2026 order day", () => {
  const window = getBusinessDateWindow("week", new Date("2026-08-10T16:00:00.000Z"));

  assert.equal(window.start.getDay(), 1);
  assert.equal(window.start.getHours(), 0);
  assert.equal(window.start.getMinutes(), 0);
  assert.equal(window.end.getHours(), 23);
  assert.equal(window.end.getMinutes(), 59);
  assert.equal(window.end.getSeconds(), 59);
  assert.equal(new Date("2026-08-10T23:30:00") >= window.start, true);
  assert.equal(new Date("2026-08-10T23:30:00") < window.end, true);
});

test("business date range controls support today 7D 30D and this month windows", () => {
  const now = new Date("2026-08-11T16:00:00.000Z");
  const today = getBusinessDateWindow("today", now);
  const sevenDays = getBusinessDateWindow("7d", now);
  const thirtyDays = getBusinessDateWindow("30d", now);
  const ninetyDays = getBusinessDateWindow("90d", now);
  const twelveMonths = getBusinessDateWindow("12m", now);
  const month = getBusinessDateWindow("month", now);

  assert.equal(today.start.getMonth(), 7);
  assert.equal(today.start.getDate(), 11);
  assert.equal(sevenDays.start.getMonth(), 7);
  assert.equal(sevenDays.start.getDate(), 5);
  assert.equal(thirtyDays.start.getMonth(), 6);
  assert.equal(thirtyDays.start.getDate(), 13);
  assert.equal(ninetyDays.start.getMonth(), 4);
  assert.equal(ninetyDays.start.getDate(), 14);
  assert.equal(twelveMonths.start.getMonth(), 8);
  assert.equal(twelveMonths.start.getFullYear(), 2025);
  assert.equal(twelveMonths.start.getDate(), 1);
  assert.equal(month.start.getMonth(), 7);
  assert.equal(month.start.getDate(), 1);
  assert.equal(today.end.getHours(), 23);
  assert.equal(sevenDays.end.getHours(), 23);
});

test("business summary builds truthful revenue chart series for 90D and 12M ranges", () => {
  const ninetyDaySummary = buildBusinessCommandCenterSummary({
    access: access({ tier: "seller" }),
    range: "90d",
    now: new Date("2026-08-11T16:00:00.000Z"),
    orders: [
      {
        id: "order-1",
        marketplace_id: "tcgplayer",
        total: 120,
        cost_of_goods: 70,
        net_profit: 50,
        ordered_at: "2026-06-01T12:00:00.000Z",
        marketplace_order_items: [{ quantity: 2, match_status: "matched", inventory_item_id: "item-1" }],
      },
      {
        id: "order-2",
        marketplace_id: "tcgplayer",
        total: 60,
        ordered_at: "2026-08-01T12:00:00.000Z",
        marketplace_order_items: [{ quantity: 1, match_status: "matched", inventory_item_id: "item-2" }],
      },
    ],
  });
  const twelveMonthSummary = buildBusinessCommandCenterSummary({
    access: access({ tier: "seller" }),
    range: "12m",
    now: new Date("2026-08-11T16:00:00.000Z"),
    orders: [
      {
        id: "order-3",
        marketplace_id: "ebay",
        total: 42,
        cost_of_goods: 20,
        net_profit: 22,
        ordered_at: "2025-09-12T12:00:00.000Z",
        marketplace_order_items: [{ quantity: 1, match_status: "matched", inventory_item_id: "item-3" }],
      },
    ],
  });

  assert.equal(ninetyDaySummary.revenueSeries.length, 13);
  assert.equal(ninetyDaySummary.revenueSeries.reduce((sum, point) => sum + point.revenue, 0), 180);
  assert.equal(ninetyDaySummary.revenueSeries.reduce((sum, point) => sum + (point.profitEstimate ?? 0), 0), 50);
  assert.ok(ninetyDaySummary.revenueSeries.some((point) => point.axisLabel.includes("May")));
  assert.equal(twelveMonthSummary.revenueSeries.length, 12);
  assert.deepEqual(twelveMonthSummary.revenueSeries.slice(0, 4).map((point) => point.axisLabel), ["Sep", "Oct", "Nov", "Dec"]);
  assert.equal(twelveMonthSummary.revenueSeries.reduce((sum, point) => sum + point.revenue, 0), 42);
  assert.equal(twelveMonthSummary.revenueSeries.find((point) => point.axisLabel === "Sep")?.profitEstimate, 22);
});

test("canonical date filtering includes orders with null ordered_at and created_at fallback", () => {
  const window = getBusinessDateWindow("week", new Date("2026-08-10T16:00:00.000Z"));
  const orders = filterOrdersByCanonicalDateRange([
    { id: "created-fallback", marketplace_id: "tcgplayer", ordered_at: null, created_at: "2026-08-10T18:00:00.000Z", total: 90 },
    { id: "outside", marketplace_id: "tcgplayer", ordered_at: null, created_at: "2026-08-03T18:00:00.000Z", total: 60 },
  ], window);

  assert.deepEqual(orders.map((order) => order.id), ["created-fallback"]);
  assert.equal(summarizeCanonicalOrders(orders).grossSales, 90);
});

test("imported orders count toward gross sales even when item matching is incomplete", () => {
  const summary = buildBusinessCommandCenterSummary({
    access: access({ tier: "seller" }),
    orders: [
      { id: "order-without-lines", marketplace_id: "tcg_player", total: 120, normalized_status: "new", marketplace_order_items: [] },
      {
        id: "order-unmatched",
        marketplace_id: "tcgplayer",
        total: 80,
        normalized_status: "new",
        marketplace_order_items: [{ marketplace_order_id: "order-unmatched", quantity: 4, match_status: "unmatched" }],
      },
    ],
    connections: [{ marketplace_id: "TCGPlayer", status: "ready" }],
  });

  const tcgplayer = summary.channelBreakdown.find((channel) => channel.id === "tcgplayer");

  assert.equal(summary.grossSales, 200);
  assert.equal(summary.orderCount, 2);
  assert.equal(summary.itemsSold, 4);
  assert.equal(summary.listingIssues, 1);
  assert.equal(summary.averageOrderValue, 100);
  assert.equal(tcgplayer?.connected, true);
  assert.equal(tcgplayer?.orderCount, 2);
  assert.equal(tcgplayer?.grossSales, 200);
  assert.equal(summary.inventoryAttribution.coveragePercent, 0);
  assert.equal(summary.profitConfidence.level, "Low");
  assert.ok(summary.signals.some((signal) => signal.type === "inventory-attribution"));
});

test("orders without known cost basis do not fabricate realized profit", () => {
  const metrics = summarizeCanonicalOrders([
    {
      id: "missing-cost",
      marketplace_id: "tcgplayer",
      total: 120,
      marketplace_fees: 12,
      shipping_cost: 4,
      normalized_status: "shipped",
      marketplace_order_items: [
        { quantity: 2, unit_price: 60, match_status: "matched", inventory_item_id: "item-1" },
      ],
    },
  ]);

  assert.equal(metrics.grossSales, 120);
  assert.equal(metrics.realizedProfit, null);
  assert.equal(metrics.profitKnownUnits, 0);
  assert.equal(metrics.profitTotalUnits, 2);
  assert.equal(metrics.profitCoverageRatio, 0);
});

test("disconnected marketplaces are distinct from connected channels with zero activity", () => {
  const summary = buildBusinessCommandCenterSummary({
    access: access({ tier: "seller" }),
    orders: [],
    connections: [{ marketplace_id: "tcgplayer", status: "ready" }],
  });

  const tcgplayer = summary.channelBreakdown.find((channel) => channel.id === "tcgplayer");
  const ebay = summary.channelBreakdown.find((channel) => channel.id === "ebay");

  assert.equal(tcgplayer?.connected, true);
  assert.equal(tcgplayer?.orderCount, 0);
  assert.equal(tcgplayer?.grossSales, 0);
  assert.equal(ebay?.connected, false);
  assert.equal(ebay?.orderCount, 0);
});

test("store users receive expanded operating metrics while sellers do not", () => {
  const sellerSummary = buildBusinessCommandCenterSummary({
    access: access({ tier: "seller" }),
    orders: [],
    employeeCount: 3,
    vendorCount: 4,
    supplyAlertCount: 5,
  });
  const storeSummary = buildBusinessCommandCenterSummary({
    access: access({ tier: "store", workspaceRole: "manager" }),
    orders: [],
    employeeCount: 3,
    vendorCount: 4,
    supplyAlertCount: 5,
  });

  assert.equal(sellerSummary.hasStoreAccess, false);
  assert.equal(sellerSummary.employeeCount, null);
  assert.equal(storeSummary.hasStoreAccess, true);
  assert.equal(storeSummary.employeeCount, 3);
  assert.equal(storeSummary.vendorCount, 4);
  assert.equal(storeSummary.supplyAlertCount, 5);
});

test("dashboard page wires business HQ through shared business summary authority", () => {
  const page = readFileSync(path.join(repoRoot, "src/app/dashboard/page.tsx"), "utf8");
  const ordersPage = readFileSync(path.join(repoRoot, "src/app/dashboard/orders/page.tsx"), "utf8");
  const component = readFileSync(
    path.join(repoRoot, "src/components/dashboard/business-command-center/BusinessCommandCenter.tsx"),
    "utf8",
  );
  const service = readFileSync(path.join(repoRoot, "src/lib/dashboard/business-command-center.ts"), "utf8");
  const repository = readFileSync(path.join(repoRoot, "src/lib/orders/order-repository.ts"), "utf8");

  assert.match(page, /canViewBusinessCommandCenter\(access\)/);
  assert.match(page, /loadBusinessCommandCenter\(\{/);
  assert.match(page, /resolvePlatformAccessForUser\(supabase, user\)/);
  assert.match(ordersPage, /resolvePlatformAccessForUser\(supabase, user\)/);
  assert.match(ordersPage, /loadCanonicalOrders\(\{/);
  assert.match(service, /loadCanonicalOrders\(\{/);
  assert.doesNotMatch(page, /effectivePlan === "seller" \|\| effectivePlan === "store"/);
  assert.match(component, /Marketplace matrix/);
  assert.match(component, /Today's Docks Brief/);
  assert.match(component, /Revenue & Profit/);
  assert.match(component, /RevenueProfitChart/);
  assert.match(component, /Revenue trend/);
  assert.match(component, /Profit is only plotted when cost basis exists/);
  assert.match(component, /Profit is not plotted yet/);
  assert.match(component, /aria-label="Revenue and profit chart"/);
  assert.match(component, /value:\s*"90d"/);
  assert.match(component, /value:\s*"12m"/);
  assert.match(component, /Profit estimate/);
  assert.match(component, /Pending cost basis/);
  assert.match(component, /Cost basis coverage/);
  assert.match(component, /Trading Docks Signals/);
  assert.match(component, /Known inventory market subtotal/);
  assert.match(component, /What Changed/);
  assert.match(component, /Profit Confidence/);
  assert.match(component, /Inventory Attribution/);
  assert.match(component, /Connect another channel/);
  assert.match(component, /Needs attention/);
  assert.match(component, /Workspace setup/);
  assert.match(component, /RANGE_OPTIONS/);
  assert.doesNotMatch(component, /Revenue pulse/);
  assert.doesNotMatch(component, /OperationalSnapshot/);
  assert.doesNotMatch(component, /FulfillmentPulse/);
  assert.match(service, /end\.setHours\(23, 59, 59, 999\)/);
  assert.match(repository, /CANONICAL_ORDER_SELECT[\s\S]*marketplace_order_items\(\*\)/);
  assert.match(repository, /\.eq\("user_id", userId\)/);
  assert.match(repository, /rowsUsingCreatedAtFallback/);
  assert.match(repository, /sampleOrder/);
  assert.match(service, /\.eq\("workspace_id", access\.workspaceId\)/);
  assert.match(service, /\.from<InventoryCapitalRow>\("inventory_items"\)[\s\S]*\.eq\("user_id", access\.userId\)/);
  assert.match(service, /\.from<ListingRow>\("marketplace_listing_mappings"\)[\s\S]*\.eq\("user_id", access\.userId\)/);
});
