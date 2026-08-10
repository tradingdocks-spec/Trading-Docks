import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildBusinessCommandCenterSummary,
  canViewBusinessCommandCenter,
  canViewStoreOperations,
} from "../src/lib/dashboard/business-command-center.ts";
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
      { id: "order-1", marketplace_id: "tcgplayer", total: 100, net_profit: 42, normalized_status: "new" },
      { id: "order-2", marketplace_id: "ebay", total: "50.50", net_profit: "10.25", normalized_status: "shipped" },
    ],
    previousOrders: [{ id: "prior-1", marketplace_id: "tcgplayer", total: 75 }],
    orderItems: [
      { marketplace_order_id: "order-1", quantity: 2, match_status: "matched" },
      { marketplace_order_id: "order-2", quantity: "3", match_status: "unmatched" },
    ],
    connections: [{ marketplace_id: "tcgplayer", status: "ready" }],
    syncRuns: [{ marketplace_id: "tcgplayer", status: "failed" }],
  });

  assert.equal(summary.grossSales, 150.5);
  assert.equal(summary.orderCount, 2);
  assert.equal(summary.itemsSold, 5);
  assert.equal(summary.averageOrderValue, 75.25);
  assert.equal(summary.realizedProfit, 52.25);
  assert.equal(summary.openFulfillmentCount, 1);
  assert.equal(summary.listingIssues, 1);
  assert.equal(summary.syncIssues, 1);
  assert.equal(summary.channelBreakdown.find((channel) => channel.id === "tcgplayer")?.grossSales, 100);
  assert.equal(summary.channelBreakdown.find((channel) => channel.id === "ebay")?.grossSales, 50.5);
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
  const component = readFileSync(
    path.join(repoRoot, "src/components/dashboard/business-command-center/BusinessCommandCenter.tsx"),
    "utf8",
  );
  const service = readFileSync(path.join(repoRoot, "src/lib/dashboard/business-command-center.ts"), "utf8");

  assert.match(page, /canViewBusinessCommandCenter\(access\)/);
  assert.match(page, /loadBusinessCommandCenter\(\{/);
  assert.doesNotMatch(page, /effectivePlan === "seller" \|\| effectivePlan === "store"/);
  assert.match(component, /Connect marketplace/);
  assert.match(component, /Connected, zero orders/);
  assert.match(service, /\.eq\("user_id", access\.userId\)/);
  assert.match(service, /\.eq\("workspace_id", access\.workspaceId\)/);
});
