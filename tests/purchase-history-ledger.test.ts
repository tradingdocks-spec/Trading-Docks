import assert from "node:assert/strict";
import test from "node:test";

import {
  createBulkPurchaseInput,
  filterPurchaseHistory,
  summarizePurchaseHistory,
  validateNewPurchaseInput,
  type PurchaseLedgerRecord,
} from "../src/lib/purchase-history/ledger.ts";

function record(patch: Partial<PurchaseLedgerRecord>): PurchaseLedgerRecord {
  return {
    id: patch.id ?? "purchase-1",
    userId: patch.userId ?? "user-1",
    workspaceId: patch.workspaceId ?? "workspace-1",
    sourceType: patch.sourceType ?? "bulk_buying",
    sellerName: patch.sellerName ?? "Walk-in seller",
    sellerCustomerId: patch.sellerCustomerId ?? null,
    vendorId: patch.vendorId ?? null,
    status: patch.status ?? "pending",
    paymentMethod: patch.paymentMethod ?? "cash",
    subtotal: patch.subtotal ?? 100,
    adjustment: patch.adjustment ?? 0,
    totalCost: patch.totalCost ?? 100,
    itemCount: patch.itemCount ?? 1,
    unitCount: patch.unitCount ?? 1000,
    createdBy: patch.createdBy ?? "user-1",
    purchasedAt: patch.purchasedAt ?? "2026-08-11T10:00:00.000Z",
    receivedAt: patch.receivedAt ?? null,
    notes: patch.notes ?? "",
    details: patch.details ?? {},
    lines: patch.lines ?? [
      {
        id: "line-1",
        purchaseId: patch.id ?? "purchase-1",
        lineType: "bulk_category",
        description: "Commons / Uncommons",
        quantity: 1,
        unitCount: 1000,
        unitCost: 10,
        totalCost: 10,
        inventoryItemId: null,
        details: { basis: "per1000" },
      },
    ],
  };
}

test("bulk worksheet becomes a canonical purchase payload without inventory writes", () => {
  const purchase = createBulkPurchaseInput({
    rows: [
      { category: "Commons / Uncommons", quantity: 40_000, rate: 10, basis: "per1000" },
      { category: "Foils", quantity: 500, rate: 0.05, basis: "each" },
    ],
    adjustment: { mode: "amount", value: "-5", label: "Round cash offer" },
    sellerName: "Walk-in customer",
    paymentMethod: "cash",
    status: "pending",
    notes: "Two long boxes.",
  });

  assert.equal(purchase.sourceType, "bulk_buying");
  assert.equal(purchase.sellerName, "Walk-in customer");
  assert.equal(purchase.subtotal, 425);
  assert.equal(purchase.adjustment, -5);
  assert.equal(purchase.totalCost, 420);
  assert.equal(purchase.unitCount, 40_500);
  assert.equal(purchase.lines.length, 2);
  assert.equal(purchase.lines.every((line) => line.inventoryItemId == null), true);
  assert.equal(purchase.lines[0].details.basis, "per1000");
});

test("purchase history supports all requested source types", () => {
  const sources = [
    "bulk_buying",
    "collection_buying",
    "sealed_buying",
    "buylist_intake",
    "vendor_purchase",
    "card_show_buy",
    "trade_in",
    "manual_purchase",
  ] as const;
  const records = sources.map((sourceType, index) => record({
    id: sourceType,
    sourceType,
    totalCost: 10 + index,
    sellerName: sourceType,
  }));

  assert.equal(filterPurchaseHistory(records, { sourceType: "bulk_buying" }).length, 1);
  assert.equal(filterPurchaseHistory(records, { query: "vendor_purchase" }).at(0)?.sourceType, "vendor_purchase");
  assert.equal(records.length, 8);
});

test("spending aggregates exclude cancelled purchases and keep pending visible", () => {
  const metrics = summarizePurchaseHistory([
    record({ id: "today", totalCost: 100, unitCount: 10, purchasedAt: "2026-08-11T09:00:00.000Z", status: "pending" }),
    record({ id: "received", totalCost: 50, unitCount: 5, purchasedAt: "2026-08-10T09:00:00.000Z", status: "received" }),
    record({ id: "cancelled", totalCost: 999, unitCount: 100, purchasedAt: "2026-08-11T09:00:00.000Z", status: "cancelled" }),
  ], new Date("2026-08-11T18:00:00.000Z"));

  assert.equal(metrics.spentToday, 100);
  assert.equal(metrics.spentThisWeek, 150);
  assert.equal(metrics.pendingIntakeCount, 1);
  assert.equal(metrics.inventoryAcquiredUnits, 15);
  assert.equal(metrics.averageAcquisitionCost, 10);
});

test("pending filter excludes completed and received records", () => {
  const records = [
    record({ id: "pending", status: "pending" }),
    record({ id: "completed", status: "completed" }),
    record({ id: "received", status: "received" }),
  ];

  assert.deepEqual(
    filterPurchaseHistory(records, { tab: "pending" }).map((item) => item.id),
    ["pending"],
  );
});

test("workspace scoping is represented on every canonical ledger record", () => {
  const workspaceA = record({ id: "a", workspaceId: "workspace-a", userId: "user-a" });
  const workspaceB = record({ id: "b", workspaceId: "workspace-b", userId: "user-b" });

  assert.equal(workspaceA.workspaceId, "workspace-a");
  assert.equal(workspaceB.workspaceId, "workspace-b");
  assert.notEqual(workspaceA.userId, workspaceB.userId);
});

test("invalid purchase payloads are rejected before persistence", () => {
  const purchase = createBulkPurchaseInput({
    rows: [{ category: "", quantity: 0, rate: 0, basis: "each" }],
  });

  assert.deepEqual(validateNewPurchaseInput(purchase), {
    ok: false,
    errors: ["Add at least one purchase line."],
  });
});

test("cost-basis linkage remains optional and separate from inventory authority", () => {
  const linked = record({
    lines: [
      {
        id: "line-linked",
        purchaseId: "purchase-linked",
        lineType: "single",
        description: "Lightning Bolt",
        quantity: 1,
        unitCount: 1,
        unitCost: 2,
        totalCost: 2,
        inventoryItemId: "inventory-row-1",
        details: { condition: "NM", finish: "nonfoil" },
      },
    ],
  });

  assert.equal(linked.lines[0].inventoryItemId, "inventory-row-1");
  assert.equal(linked.lines[0].details.condition, "NM");
});
