import assert from "node:assert/strict";
import test from "node:test";
import { matchesInventorySearch } from "../src/lib/inventory-provenance.ts";

test("inventory search matches owned identity case-insensitively and by partial name", () => {
  assert.equal(matchesInventorySearch(["Innkeeper's Talent", "blb", "157"], "Innkeeper's Talent"), true);
  assert.equal(matchesInventorySearch(["Innkeeper's Talent", "blb", "157"], "Innkeep"), true);
  assert.equal(matchesInventorySearch(["Innkeeper's Talent", "blb", "157"], "BLB"), true);
  assert.equal(matchesInventorySearch(["Innkeeper's Talent", "blb", "157"], "158"), false);
});

test("inventory search includes physical provenance fields without requiring a catalog printing", () => {
  const values = ["BATCH-0042", "September Bulk Intake", "UC Bulk Boxes", "Near Mint", "Normal"];
  assert.equal(matchesInventorySearch(values, "batch-0042"), true);
  assert.equal(matchesInventorySearch(values, "September Bulk"), true);
  assert.equal(matchesInventorySearch(values, "uc bulk"), true);
});

test("provenance positions remain separate even when card identity is shared", () => {
  const positions = [
    { itemId: "owned-1", batch: "BATCH-0042", location: "UC Bulk Boxes", quantity: 1 },
    { itemId: "owned-1", batch: "BATCH-0061", location: "Binder A", quantity: 2 },
  ];
  assert.equal(new Set(positions.map((position) => `${position.itemId}:${position.batch}`)).size, 2);
  assert.equal(positions.reduce((sum, position) => sum + position.quantity, 0), 3);
});
