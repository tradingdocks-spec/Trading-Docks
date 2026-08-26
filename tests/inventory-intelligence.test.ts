import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  buildInventoryAttentionSummary,
  INVENTORY_ATTENTION_REPRESENTATIVE_LIMIT,
  INVENTORY_ATTENTION_SAMPLE_SIZE,
  inventoryAttentionHref,
  loadInventoryAttentionSummary,
} from "../src/lib/inventory/intelligence.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("inventory attention creates only setup work for an empty user", () => {
  const summary = buildInventoryAttentionSummary({
    userId: "user-empty",
    rows: [],
    totalInventoryRows: 0,
    now: new Date("2026-08-10T12:00:00.000Z"),
  });

  assert.equal(summary.totalIssues, 1);
  assert.equal(summary.groups[0]?.type, "inventory_setup_required");
  assert.equal(summary.groups[0]?.severity, "low");
  assert.equal(summary.categoryCounts.setup, 1);
  assert.equal(summary.categoryCounts.pricing, 0);
});

test("inventory attention returns no issues for clean inventory", () => {
  const summary = buildInventoryAttentionSummary({
    userId: "user-clean",
    rows: [
      {
        id: "card-1",
        card_name: "Lightning Bolt",
        quantity: 4,
        inventory_value: 12,
        location_id: "binder-1",
        data: { condition: "near_mint", finish: "normal" },
      },
    ],
    totalInventoryRows: 1,
  });

  assert.equal(summary.totalIssues, 0);
  assert.equal(summary.groups.length, 0);
  assert.equal(summary.storageCoveragePercent, 100);
  assert.equal(summary.priceCoveragePercent, 100);
});

test("inventory attention groups missing price storage condition and finish", () => {
  const summary = buildInventoryAttentionSummary({
    userId: "user-issues",
    rows: [
      {
        id: "card-1",
        card_name: "Rhystic Study",
        quantity: 1,
        inventory_value: 0,
        location_id: null,
        set_code: "WOT",
        collector_number: "25",
        data: { condition: "unknown", finish: "unknown" },
      },
      {
        id: "card-2",
        card_name: "Arcane Signet",
        quantity: 2,
        inventory_value: null,
        location_id: "box-1",
        data: { condition: "near_mint", finish: "normal" },
      },
    ],
    totalInventoryRows: 2,
  });

  assert.equal(summary.totalIssues, 5);
  assert.equal(summary.categoryCounts.pricing, 2);
  assert.equal(summary.categoryCounts.organization, 1);
  assert.equal(summary.categoryCounts.dataQuality, 2);
  assert.deepEqual(summary.groups.map((group) => group.type), [
    "missing_price",
    "missing_storage_location",
    "unknown_condition",
    "unknown_finish",
  ]);
  assert.equal(summary.groups[0]?.severity, "high");
  assert.equal(summary.groups[0]?.actionHref, inventoryAttentionHref("missing_price"));
});

test("inventory attention representative items are bounded for large issue groups", () => {
  const rows = Array.from({ length: INVENTORY_ATTENTION_REPRESENTATIVE_LIMIT + 3 }, (_, index) => ({
    id: `card-${index}`,
    card_name: `Card ${index}`,
    quantity: 1,
    inventory_value: 0,
    location_id: null,
    data: { condition: "near_mint", finish: "normal" },
  }));
  const summary = buildInventoryAttentionSummary({
    userId: "user-large",
    rows,
    totalInventoryRows: rows.length,
  });
  const group = summary.groups.find((item) => item.type === "missing_price");

  assert.equal(group?.count, INVENTORY_ATTENTION_REPRESENTATIVE_LIMIT + 3);
  assert.equal(group?.representativeItems.length, INVENTORY_ATTENTION_REPRESENTATIVE_LIMIT);
});

test("inventory attention loader scopes every query to the authenticated user", async () => {
  const calls: Array<{ table: string; column: string; value: string }> = [];
  const supabase = {
    from(table: string) {
      return {
        select(_columns: string, options?: { count?: "exact"; head?: boolean }) {
          const query = {
            eq(column: string, value: string) {
              calls.push({ table, column, value });
              return query;
            },
            order() {
              return query;
            },
            limit() {
              return query;
            },
            then(resolve: (value: unknown) => void) {
              resolve(options?.head ? { data: null, count: 7, error: null } : { data: [], error: null });
            },
          };
          return query;
        },
      };
    },
  };

  const summary = await loadInventoryAttentionSummary({
    supabase,
    userId: "trusted-user",
    workspaceId: "workspace-1",
  });

  assert.equal(summary.userId, "trusted-user");
  assert.equal(calls.length, 2);
  assert.ok(calls.every((call) => call.table === "inventory_items"));
  assert.ok(calls.every((call) => call.column === "user_id"));
  assert.ok(calls.every((call) => call.value === "trusted-user"));
});

test("inventory inbox and command center consume shared inventory intelligence", () => {
  const page = readFileSync(path.join(repoRoot, "src/app/dashboard/inventory/inbox/page.tsx"), "utf8");
  const dashboard = readFileSync(path.join(repoRoot, "src/lib/dashboard/personal-command-center.ts"), "utf8");
  const inventory = readFileSync(path.join(repoRoot, "src/components/dashboard/collector-workspace/CollectorWorkspace.tsx"), "utf8");
  const navigation = readFileSync(path.join(repoRoot, "src/components/dashboard/navigation.ts"), "utf8");

  assert.match(page, /loadInventoryAttentionSummary\(\{/);
  assert.match(page, /resolvePlatformAccessForUser\(supabase, user\)/);
  assert.match(dashboard, /buildInventoryAttentionSummary/);
  assert.match(dashboard, /loadInventoryAttentionSummary/);
  assert.match(inventory, /attention === "missing_price"/);
  assert.match(inventory, /attention === "missing_storage_location"/);
  assert.match(navigation, /Inventory Inbox/);
  assert.match(page, /Showing grouped findings/);
  assert.match(page, /No inventory attention items found/);
  assert.match(page, /does not show demo/i);
});

test("inventory attention documents bounded sample sizing", () => {
  assert.equal(INVENTORY_ATTENTION_SAMPLE_SIZE, 500);
});
