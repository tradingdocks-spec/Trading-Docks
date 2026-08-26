export type InventoryEventType =
  | "inventory_created"
  | "quantity_added"
  | "quantity_removed"
  | "quantity_adjusted"
  | "location_changed"
  | "condition_changed"
  | "finish_changed"
  | "cost_basis_changed"
  | "imported"
  | "inventory_archived"
  | "inventory_restored";

export type InventoryEventSource =
  | "collector_workspace"
  | "manual"
  | "mobile"
  | "scanner"
  | "scanner_replay"
  | "purchasing_intelligence"
  | "csv_import"
  | "tcgplayer_import"
  | "ebay_import"
  | "shopify_import"
  | "system";

export type InventoryEventPayload = {
  user_id: string;
  workspace_id?: string | null;
  inventory_item_id?: string | null;
  event_type: InventoryEventType;
  source?: InventoryEventSource;
  source_id?: string | null;
  related_entity_type?: string | null;
  related_entity_id?: string | null;
  quantity_before?: number | null;
  quantity_change?: number | null;
  quantity_after?: number | null;
  previous_value?: string | null;
  next_value?: string | null;
  previous_location_id?: string | null;
  next_location_id?: string | null;
  previous_unit_cost?: number | null;
  next_unit_cost?: number | null;
  previous_total_cost?: number | null;
  next_total_cost?: number | null;
  unit_cost?: number | null;
  total_cost?: number | null;
  unit_value?: number | null;
  total_value?: number | null;
  currency?: string;
  idempotency_key?: string | null;
  card_name?: string | null;
  product_type?: string | null;
  game_id?: string | null;
  scryfall_id?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  tcgplayer_product_id?: number | null;
  tcgplayer_sku_id?: number | null;
  condition?: string | null;
  finish?: string | null;
  language?: string | null;
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
  source = "collector_workspace",
  idempotencyKey = null,
  metadata = {},
}: {
  userId: string;
  inventoryItemId: string;
  eventType: InventoryEventType;
  beforeQuantity?: number | null;
  afterQuantity?: number | null;
  source?: InventoryEventSource;
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

export function inventoryMutationIdempotencyKey({
  source,
  inventoryItemId,
  mutationType,
  value,
  timestamp = new Date().toISOString(),
}: {
  source: InventoryEventSource;
  inventoryItemId: string;
  mutationType: string;
  value?: string | number | null;
  timestamp?: string;
}) {
  return `${source}:${inventoryItemId}:${mutationType}:${value ?? "none"}:${timestamp}`;
}

export async function recordInventoryEvent(
  supabase: SupabaseLike,
  payload: InventoryEventPayload,
): Promise<InventoryEventResult> {
  const { error } = await supabase.from("inventory_events").insert({
    currency: "USD",
    source: "system",
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
