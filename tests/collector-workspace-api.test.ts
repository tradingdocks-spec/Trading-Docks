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
  assert.match(source, /if \(mutation\.type === "quantity"\)/);
  assert.match(source, /hasFullPlatformAccess: access\.hasFullPlatformAccess/);
});

test("Collector Workspace metadata edits do not perform quantity-limit scans", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/collector-workspace/mutations/route.ts"),
    "utf8",
  );
  const quantityBranch = source.match(/if \(mutation\.type === "quantity"\) \{[\s\S]*?currentTotalQuantity = quantityResult\.total;/)?.[0] ?? "";
  assert.match(quantityBranch, /totalOwnedCardQuantity/);
  assert.match(source, /let currentTotalQuantity = currentCardQuantity/);
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

test("Collector Workspace bulk removal validates ownership and reuses the lot removal RPC", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/collector-workspace/bulk-remove/route.ts"),
    "utf8",
  );

  assert.match(source, /requireApiCapability\("collection\.write"\)/);
  assert.match(source, /\.from\("inventory_items"\)/);
  assert.match(source, /\.eq\("user_id", user\.id\)/);
  assert.match(source, /\.in\("id", ids\)/);
  assert.match(source, /rows\.length !== ids\.length/);
  assert.match(source, /\.rpc\("remove_inventory_lot_quantity"/);
  assert.match(source, /p_reason: reason/);
  assert.match(source, /eventTypes: \["quantity_removed"\]/);
});

test("Collector Workspace bulk removal hides missing RPC internals from users", () => {
  const source = readFileSync(
    path.join(repoRoot, "src/app/api/collector-workspace/bulk-remove/route.ts"),
    "utf8",
  );

  assert.match(source, /isMissingInventoryRemovalRpcError/);
  assert.match(source, /PGRST202/);
  assert.match(source, /Inventory removal is temporarily unavailable in this environment\./);
  assert.match(source, /inventory_removal_unavailable/);
  assert.match(source, /We couldn't remove these cards\. Nothing was changed\. Please try again\./);
  assert.match(source, /console\.error\("Collector bulk removal RPC failed"/);
  assert.doesNotMatch(source, /return NextResponse\.json\(\{ error: removeError\.message/);
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
