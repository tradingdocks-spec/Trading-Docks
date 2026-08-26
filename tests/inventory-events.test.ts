import test from "node:test";
import assert from "node:assert/strict";

import {
  buildInventoryMutationEvent,
  recordInventoryEvent,
} from "../src/lib/inventory/events.ts";

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
