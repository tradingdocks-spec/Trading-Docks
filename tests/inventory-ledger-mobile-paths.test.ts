import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function read(relativePath: string) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("mobile collector mutations use the inventory ledger RPC for inventory item changes", () => {
  const source = read("mobile/services/collector-mutation-data.ts");

  assert.match(source, /persistCollectorEdit/);
  assert.match(source, /deliverCollectorEdit/);
  const command = read("mobile/services/collector-inventory-command.ts");
  assert.match(command, /endpoint: 'apply_collector_inventory_mutation'/);
  assert.match(command, /p_idempotency_key: operationId/);
  assert.doesNotMatch(source, /p_idempotency_key: mutationQueueKey/);
});

test("mobile scanner saves and replay use the creation ledger RPC", () => {
  const scanner = read("mobile/services/scanner-data.ts");
  const replay = read("mobile/services/scanner-replay.ts");

  const contract = read("mobile/services/scanner-foundation.ts");
  assert.match(contract, /endpoint: 'create_inventory_item_with_event'/);
  assert.match(contract, /p_source: 'scanner'/);
  assert.match(contract, /p_idempotency_key: operationId/);
  assert.match(scanner, /prepareOfflineOperation/);
  assert.match(replay, /deliverInventoryCommand/);
  assert.match(replay, /supabase\.rpc\(endpoint, args\)/);
  assert.doesNotMatch(replay, /inventoryItemExists|buildScannerAddPayload|validateQueuedPrintingIdentity|scanner-replay:/);
});

test("mobile storage assignment uses the inventory mutation ledger RPC", () => {
  const source = read("mobile/services/storage-location-data.ts");

  assert.match(source, /runMobileCollectorMutation/);
  assert.match(source, /type: 'storage'/);
  assert.doesNotMatch(source, /supabase\.rpc/);
});
