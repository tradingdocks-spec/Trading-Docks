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

test("Collector mutation API forwards immutable whitelisted commands without reminting keys", () => {
  const source = readFileSync(path.join(repoRoot, "src/app/api/collector-workspace/mutations/route.ts"), "utf8");
  assert.match(source, /'apply_collector_inventory_mutation', 'remove_inventory_lot_quantity', 'move_inventory_lot_quantity'/);
  assert.match(source, /supabase\.rpc\(endpoint, args\)/);
  assert.match(source, /OPERATION_ID_REQUIRED/); assert.match(source, /access.isSuspended/);
  assert.doesNotMatch(source, /inventoryMutationIdempotencyKey|recordCollectorEvent/);
});
test("partial move/removal commands retain exact quantity, reason and destination", () => {
  const source = readFileSync(path.join(repoRoot, "mobile/services/collector-inventory-command.ts"), "utf8");
  assert.match(source, /p_quantity: mutation.quantity/); assert.match(source, /p_reason: mutation.reason/);
  assert.match(source, /p_to_location_id: mutation.storageLocationId/); assert.match(source, /p_idempotency_key: operationId/);
});
test("legacy bulk IDs-only endpoint fails closed instead of rereading retry quantities", () => {
  const source = readFileSync(path.join(repoRoot, "src/app/api/collector-workspace/bulk-remove/route.ts"), "utf8");
  assert.match(source, /requireApiCapability/); assert.match(source, /OPERATION_ID_REQUIRED/);
  assert.doesNotMatch(source, /\.rpc\(|\.from\(/);
});
test("bulk uncertainty is honest and retained for original-command recovery", () => {
  const source = readFileSync(path.join(repoRoot, "src/lib/collector-workspace-client-data.ts"), "utf8");
  assert.match(source, /persistInventoryBatch/); assert.match(source, /deliverInventoryBatch/);
  assert.match(source, /Earlier rows may have completed/); assert.doesNotMatch(source, /Nothing was changed/);
});

test("Collection location authority migration exposes deployable lot removal RPCs", () => {
  const migration = readFileSync(
    path.join(repoRoot, "supabase/migrations/202608260001_collection_location_authority.sql"),
    "utf8",
  );

  assert.match(migration, /Forward-only deployable migration/);
  assert.match(migration, /create or replace function public\.remove_inventory_lot_quantity\(/);
  assert.match(migration, /p_inventory_item_id text/);
  assert.match(migration, /p_quantity integer/);
  assert.match(migration, /p_reason text default 'Removed from collection'/);
  assert.match(migration, /p_idempotency_key text default null/);
  assert.match(migration, /p_source public\.inventory_event_source default 'collector_workspace'/);
  assert.match(migration, /grant execute on function public\.remove_inventory_lot_quantity\(text, integer, text, text, public\.inventory_event_source\) to authenticated/);
  assert.match(migration, /pg_notify\('pgrst', 'reload schema'\)/);
  assert.doesNotMatch(migration, /Do not apply without production review/);
});
