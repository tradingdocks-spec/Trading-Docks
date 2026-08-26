export type InventoryEventType =
  | "inventory_created"
  | "quantity_added"
  | "quantity_removed"
  | "sold"
  | "returned"
  | "adjusted"
  | "moved_location"
  | "condition_changed"
  | "finish_changed"
  | "price_updated"
  | "cost_basis_updated"
  | "imported"
  | "transferred"
  | "deleted_archived"
  | "baseline_snapshot";

export type InventoryEventPayload = {
  user_id: string;
  workspace_id?: string | null;
  inventory_item_id?: string | null;
  event_type: InventoryEventType;
  quantity_before?: number | null;
  quantity_change?: number | null;
  quantity_after?: number | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  unit_value?: number | null;
  total_value?: number | null;
  currency?: string;
  source?: string;
  source_id?: string | null;
  idempotency_key?: string | null;
  card_name?: string | null;
  game_id?: string | null;
  scryfall_id?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  condition?: string | null;
  finish?: string | null;
  location_id?: string | null;
  metadata?: Record<string, unknown>;
  occurred_at?: string;
};

export type InventoryEventResult =
  | { recorded: true }
  | { recorded: false; reason: "schema_unavailable" | "duplicate" };

type SupabaseLike = {
  from: (table: string) => {
    insert: (payload: InventoryEventPayload) => PromiseLike<{ error?: { message?: string; code?: string } | null }>;
  };
};

export function buildInventoryMutationEvent({
  userId,
  inventoryItemId,
  eventType,
  beforeQuantity = null,
  afterQuantity = null,
  source = "collector-workspace",
  idempotencyKey = null,
  metadata = {},
}: {
  userId: string;
  inventoryItemId: string;
  eventType: InventoryEventType;
  beforeQuantity?: number | null;
  afterQuantity?: number | null;
  source?: string;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown>;
}): InventoryEventPayload {
  const change = beforeQuantity === null || afterQuantity === null ? null : afterQuantity - beforeQuantity;
  return {
    user_id: userId,
    inventory_item_id: inventoryItemId,
    event_type: eventType,
    quantity_before: beforeQuantity,
    quantity_change: change,
    quantity_after: afterQuantity,
    currency: "USD",
    source,
    idempotency_key: idempotencyKey,
    metadata,
    occurred_at: new Date().toISOString(),
  };
}

export async function recordInventoryEvent(
  supabase: SupabaseLike,
  payload: InventoryEventPayload,
): Promise<InventoryEventResult> {
  const { error } = await supabase.from("inventory_events").insert({
    currency: "USD",
    source: "application",
    metadata: {},
    ...payload,
  });
  if (!error) return { recorded: true };
  const message = error.message ?? "";
  if (error.code === "42P01" || /inventory_events|schema cache|does not exist/i.test(message)) {
    return { recorded: false, reason: "schema_unavailable" };
  }
  if (error.code === "23505") return { recorded: false, reason: "duplicate" };
  throw new Error(message || "Inventory event recording failed.");
}
