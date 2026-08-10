import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInventoryUsageByUser,
  resolveAccountUsage,
} from "../src/lib/admin/account-usage.ts";

test("admin account usage uses live inventory_items totals when present", () => {
  const inventoryUsage = buildInventoryUsageByUser([
    { user_id: "user-a", id: "row-1", quantity: 20, updated_at: "2026-08-01T00:00:00.000Z" },
    { user_id: "user-a", id: "row-2", quantity: 9, updated_at: "2026-08-02T00:00:00.000Z" },
    { user_id: "user-a", id: "row-3", quantity: 0, updated_at: "2026-08-03T00:00:00.000Z" },
  ]);

  assert.deepEqual(
    resolveAccountUsage({
      userId: "user-a",
      inventoryUsage,
      cachedUsage: {
        user_id: "user-a",
        card_units: 0,
        unique_inventory_rows: 0,
        updated_at: "2026-07-01T00:00:00.000Z",
      },
    }),
    {
      cardUnits: 29,
      uniqueInventoryRows: 3,
      updatedAt: "2026-08-03T00:00:00.000Z",
      source: "inventory_items",
    },
  );
});

test("admin account usage falls back to legacy cache only when live inventory is absent", () => {
  assert.deepEqual(
    resolveAccountUsage({
      userId: "user-b",
      inventoryUsage: new Map(),
      cachedUsage: {
        user_id: "user-b",
        card_units: "42",
        unique_inventory_rows: "11",
        updated_at: "2026-08-04T00:00:00.000Z",
      },
    }),
    {
      cardUnits: 42,
      uniqueInventoryRows: 11,
      updatedAt: "2026-08-04T00:00:00.000Z",
      source: "account_card_usage",
    },
  );
});
