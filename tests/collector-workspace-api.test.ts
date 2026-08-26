import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Collector Workspace mutation API does not cap Free-plan quantity checks at one page", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/collector-workspace/mutations/route.ts"),
    "utf8",
  );

  assert.match(source, /async function totalOwnedCardQuantity/);
  assert.match(source, /\.range\(from, from \+ pageSize - 1\)/);
  assert.doesNotMatch(source, /\.select\("quantity"\)\.eq\("user_id", user\.id\)\.limit\(1000\)/);
});

test("Collector Workspace inventory mutations use the transactional ledger RPC", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/collector-workspace/mutations/route.ts"),
    "utf8",
  );

  assert.match(source, /applyInventoryMutation/);
  assert.match(source, /\.rpc\("apply_collector_inventory_mutation"/);
  assert.match(source, /mutationType: "quantity"/);
  assert.match(source, /mutationType: mutation\.type/);
  assert.match(source, /mutationType: "storage"/);
  assert.match(source, /inventoryMutationIdempotencyKey/);
  assert.doesNotMatch(source, /recordCollectorEvent/);
  assert.doesNotMatch(source, /eventType: "moved_location"/);
  assert.doesNotMatch(source, /eventType: mutation\.quantity > beforeQuantity/);
});

test("Collector Workspace partial move and removal use authoritative lot RPCs", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/collector-workspace/mutations/route.ts"),
    "utf8",
  );

  assert.match(source, /mutation\.type === "move_quantity"/);
  assert.match(source, /\.rpc\("move_inventory_lot_quantity"/);
  assert.match(source, /p_to_location_id: mutation\.storageLocationId/);
  assert.match(source, /mutation\.type === "remove_quantity"/);
  assert.match(source, /\.rpc\("remove_inventory_lot_quantity"/);
  assert.match(source, /p_reason: mutation\.reason/);
});
