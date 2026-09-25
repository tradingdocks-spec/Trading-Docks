import { availableMoney } from "@/lib/intelligence-provenance";
import { createClient } from "@/lib/supabase/client";

export type InventoryPersistenceRecord = {
  id: string;
  [key: string]: unknown;
};

export type InventorySnapshot = {
  locations: InventoryPersistenceRecord[];
  items: InventoryPersistenceRecord[];
  movements: InventoryPersistenceRecord[];
};

type InventoryCollection = keyof InventorySnapshot;

type InventoryDataRow = {
  id: string;
  data: unknown;
  name?: string | null;
  card_name?: string | null;
  location_id?: string | null;
  location_type?: string | null;
  sku?: string | null;
  scryfall_id?: string | null;
  set_code?: string | null;
  collector_number?: string | null;
  quantity?: number | null;
  inventory_value?: number | null;
};

const TABLES: Record<InventoryCollection, string> = {
  locations: "inventory_locations",
  items: "inventory_items",
  movements: "inventory_movements",
};


export async function loadInventorySnapshot(): Promise<InventorySnapshot> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in again to load your inventory.");

  const [locations, items, movements] = await Promise.all(
    (Object.keys(TABLES) as InventoryCollection[]).map(async (collection) => {
      const { data, error } = await supabase
        .from(TABLES[collection])
        .select("*")
        .eq("user_id", user.id);
      if (error) throw new Error(`Inventory storage is unavailable: ${error.message}`);
      return ((data ?? []) as InventoryDataRow[])
        .map((row) => mergeDatabaseFields(collection, row))
        .filter(isInventoryRecord)
        // Zero-quantity lots remain in the ledger for history, but are no
        // longer active inventory and must not appear in inventory/search.
        .filter((record) => collection !== "items" || Number(record.quantity ?? 0) > 0);
    }),
  );

  const batchByItem = await loadChaosSortBatchCodes(supabase, user.id);
  const itemsWithBatchCodes = items.map((item) => ({
    ...item,
    batchCode: item.batchCode || batchByItem.get(item.id) || "",
  }));

  return { locations, items: itemsWithBatchCodes, movements };
}

async function loadChaosSortBatchCodes(supabase: ReturnType<typeof createClient>, userId: string) {
  try {
    const [{ data: positions, error: positionsError }, { data: batches, error: batchesError }] = await Promise.all([
      supabase
        .from("chaos_sort_inventory_positions")
        .select("item_id,batch_id")
        .eq("user_id", userId)
        .gt("quantity", 0),
      supabase
        .from("chaos_sort_batches")
        .select("id,batch_code")
        .eq("user_id", userId),
    ]);
    if (positionsError || batchesError) return new Map<string, string>();

    const batchCodes = new Map(
      (batches ?? []).map((batch: { id: string; batch_code: string | null }) => [String(batch.id), String(batch.batch_code ?? "")]),
    );
    return new Map(
      (positions ?? [])
        .filter((position: { item_id: string | null; batch_id: string }) => position.item_id && batchCodes.get(String(position.batch_id)))
        .map((position: { item_id: string | null; batch_id: string }) => [String(position.item_id), batchCodes.get(String(position.batch_id)) ?? ""]),
    );
  } catch {
    // Older deployments may not have the Chaos Sort position tables yet.
    return new Map<string, string>();
  }
}

function mergeDatabaseFields(collection: InventoryCollection, row: InventoryDataRow) {
  const record = isInventoryRecord(row.data) ? row.data : { id: row.id };
  if (collection === "locations") {
    return {
      ...record,
      id: record.id || row.id,
      name: record.name || row.name || "",
      type: record.type || row.location_type || "custom",
    };
  }
  if (collection === "items") {
    return {
      ...record,
      id: record.id || row.id,
      name: record.name || row.card_name || "",
      sku: record.sku || row.sku || "",
      locationId: record.locationId || row.location_id || "",
      scryfallId: record.scryfallId || row.scryfall_id || "",
      set: record.set || row.set_code || "",
      collectorNumber: record.collectorNumber || row.collector_number || "",
      quantity: typeof record.quantity === "number" ? record.quantity : row.quantity ?? 0,
      value: typeof record.value === "number" ? record.value : row.inventory_value ?? null,
      batchCode: record.batchCode || record.batch_code || "",
      imageUrl:
        record.imageUrl ||
        (record.scryfallId || row.scryfall_id
          ? `/api/scryfall-image/${encodeURIComponent(String(record.scryfallId || row.scryfall_id))}`
          : ""),
    };
  }
  return { ...record, id: record.id || row.id };
}

export async function persistInventorySnapshotDiff(
  previous: InventorySnapshot,
  current: InventorySnapshot,
) {
  // This legacy helper has RECONCILE semantics (including deletes), not APPEND.
  // Its old chunked upsert/delete path has no immutable receipt. Do not replay it.
  if (JSON.stringify(previous) === JSON.stringify(current)) return;
  throw new Error('REVIEW_REQUIRED: legacy snapshot reconciliation is unavailable. Use the explicit durable append import or inventory edit commands. No snapshot was written.');
}

export function toDatabaseRow(
  collection: InventoryCollection,
  userId: string,
  record: InventoryPersistenceRecord,
) {
  const common = {
    id: record.id,
    user_id: userId,
    data: record,
    updated_at: new Date().toISOString(),
  };

  if (collection === "locations") {
    return {
      ...common,
      name: stringValue(record.name),
      location_type: stringValue(record.type) || "custom",
    };
  }
  if (collection === "items") {
    return {
      ...common,
      card_name: stringValue(record.name),
      sku: stringValue(record.sku),
      location_id: stringValue(record.locationId) || null,
      scryfall_id: stringValue(record.scryfallId) || null,
      set_code: stringValue(record.set) || null,
      collector_number: stringValue(record.collectorNumber) || null,
      quantity: numberValue(record.quantity),
      inventory_value: availableMoney(record.value),
      ...(Object.hasOwn(record, "askingPrice") ? { asking_price: availableMoney(record.askingPrice) } : {}),
    };
  }
  return {
    ...common,
    item_name: stringValue(record.itemName),
    occurred_at: stringValue(record.timestamp) || new Date().toISOString(),
  };
}

function isInventoryRecord(value: unknown): value is InventoryPersistenceRecord {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof (value as { id?: unknown }).id === "string",
  );
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
