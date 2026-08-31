import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildInventoryMutationEvent,
  inventoryMutationIdempotencyKey,
  recordInventoryEvent,
} from "../src/lib/inventory/events.ts";

const migration = readFileSync(
  path.join(repoRoot(), "supabase/migrations/202608120002_inventory_event_ledger.sql"),
  "utf8",
);

function repoRoot() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
}

test("inventory mutation event captures quantity movement and idempotency", () => {
  const event = buildInventoryMutationEvent({
    userId: "user-1",
    inventoryItemId: "00000000-0000-0000-0000-000000000001",
    eventType: "quantity_removed",
    beforeQuantity: 5,
    afterQuantity: 2,
    idempotencyKey: "mutation-1",
  });

  assert.equal(event.user_id, "user-1");
  assert.equal(event.inventory_item_id, "00000000-0000-0000-0000-000000000001");
  assert.equal(event.quantity_before, 5);
  assert.equal(event.quantity_change, -3);
  assert.equal(event.quantity_after, 2);
  assert.equal(event.idempotency_key, "mutation-1");
});

test("inventory mutation idempotency keys are explicit and source-scoped", () => {
  assert.equal(
    inventoryMutationIdempotencyKey({
      source: "collector_workspace",
      inventoryItemId: "item-1",
      mutationType: "quantity",
      value: 4,
      timestamp: "2026-08-12T00:00:00.000Z",
    }),
    "collector_workspace:item-1:quantity:4:2026-08-12T00:00:00.000Z",
  );
});

test("inventory event recording is safe before the ledger migration exists", async () => {
  const supabase = {
    from(table: string) {
      assert.equal(table, "inventory_events");
      return {
        async insert() {
          return { error: { code: "42P01", message: "relation public.inventory_events does not exist" } };
        },
      };
    },
  };

  const result = await recordInventoryEvent(supabase, {
    user_id: "user-1",
    inventory_item_id: "00000000-0000-0000-0000-000000000001",
    event_type: "quantity_added",
  });
  assert.deepEqual(result, { recorded: false, reason: "schema_unavailable" });
});

test("inventory event ledger migration is promoted out of proposal status", () => {
  assert.match(migration, /create table if not exists public\.inventory_events/);
  assert.match(migration, /production inventory event ledger/i);
  assert.doesNotMatch(migration, /proposal-only|baseline_snapshot/);
});

test("inventory event taxonomy is explicit and does not include vague updates", () => {
  for (const eventType of [
    "inventory_created",
    "quantity_added",
    "quantity_removed",
    "quantity_adjusted",
    "location_changed",
    "condition_changed",
    "finish_changed",
    "cost_basis_changed",
    "inventory_archived",
    "inventory_restored",
    "imported",
  ]) {
    assert.match(migration, new RegExp(`'${eventType}'`));
  }
  for (const forbidden of ["inventory_updated", "moved_location", "cost_basis_updated", "deleted_archived", "sold"]) {
    assert.doesNotMatch(migration, new RegExp(`'${forbidden}'`));
  }
  assert.doesNotMatch(migration, /'adjusted'/);
});

test("inventory event ledger uses existing text inventory/location keys safely", () => {
  assert.match(migration, /inventory_item_id text/);
  assert.match(migration, /previous_location_id text/);
  assert.match(migration, /next_location_id text/);
  assert.match(migration, /foreign key \(user_id, inventory_item_id\)[\s\S]*references public\.inventory_items\(user_id, id\)[\s\S]*on delete set null \(inventory_item_id\)/);
  assert.doesNotMatch(migration, /inventory_item_id uuid/);
  assert.doesNotMatch(migration, /location_id uuid/);
});

test("inventory event ledger is append-only for normal authenticated users", () => {
  assert.match(migration, /revoke all on public\.inventory_events from authenticated/);
  assert.match(migration, /grant select on public\.inventory_events to authenticated/);
  assert.match(migration, /Users cannot update inventory events/);
  assert.match(migration, /Users cannot delete inventory events/);
  assert.match(migration, /inventory_events_block_mutation/);
  assert.match(migration, /raise exception 'inventory_events is append-only'/);
  assert.match(migration, /revoke execute on function public\.inventory_event_workspace_for_user\(uuid\) from public/);
  assert.match(migration, /revoke execute on function public\.create_inventory_item_with_event/);
});

test("collector inventory mutation RPC locks owned rows and records events atomically", () => {
  assert.match(migration, /create or replace function public\.apply_collector_inventory_mutation/);
  assert.match(migration, /where i\.user_id = v_user_id[\s\S]*and i\.id = p_inventory_item_id[\s\S]*for update/);
  assert.match(migration, /update public\.inventory_items[\s\S]*returning \* into v_item/);
  assert.match(migration, /insert into public\.inventory_events/);
  assert.match(migration, /on conflict \(user_id, idempotency_key\) where idempotency_key is not null do nothing/);
});

test("inventory creation RPC derives user ownership from authenticated context", () => {
  assert.match(migration, /create or replace function public\.create_inventory_item_with_event/);
  assert.match(migration, /v_user_id uuid := auth\.uid\(\)/);
  assert.match(migration, /insert into public\.inventory_items \([\s\S]*user_id/);
  assert.match(migration, /v_user_id,/);
  assert.match(migration, /case when p_source in \('csv_import', 'tcgplayer_import', 'ebay_import', 'shopify_import', 'scanner_replay'\) then 'imported'/);
});
