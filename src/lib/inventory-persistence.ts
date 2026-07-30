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
  data: unknown;
};

const TABLES: Record<InventoryCollection, string> = {
  locations: "inventory_locations",
  items: "inventory_items",
  movements: "inventory_movements",
};

const CHUNK_SIZE = 500;

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
        .select("data")
        .eq("user_id", user.id);
      if (error) throw new Error(`Inventory storage is unavailable: ${error.message}`);
      return ((data ?? []) as InventoryDataRow[])
        .map((row) => row.data)
        .filter(isInventoryRecord);
    }),
  );

  return { locations, items, movements };
}

export async function persistInventorySnapshotDiff(
  previous: InventorySnapshot,
  current: InventorySnapshot,
) {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in again to save your inventory.");

  for (const collection of Object.keys(TABLES) as InventoryCollection[]) {
    const before = new Map(previous[collection].map((record) => [record.id, JSON.stringify(record)]));
    const after = new Map(current[collection].map((record) => [record.id, record]));
    const changed = current[collection].filter(
      (record) => before.get(record.id) !== JSON.stringify(record),
    );
    const removed = previous[collection]
      .filter((record) => !after.has(record.id))
      .map((record) => record.id);

    for (let index = 0; index < changed.length; index += CHUNK_SIZE) {
      const rows = changed
        .slice(index, index + CHUNK_SIZE)
        .map((record) => toDatabaseRow(collection, user.id, record));
      const { error } = await supabase.from(TABLES[collection]).upsert(rows, {
        onConflict: "user_id,id",
      });
      if (error) throw new Error(`Inventory could not be saved: ${error.message}`);
    }

    for (let index = 0; index < removed.length; index += CHUNK_SIZE) {
      const { error } = await supabase
        .from(TABLES[collection])
        .delete()
        .eq("user_id", user.id)
        .in("id", removed.slice(index, index + CHUNK_SIZE));
      if (error) throw new Error(`Inventory could not be updated: ${error.message}`);
    }
  }
}

function toDatabaseRow(
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
      inventory_value: numberValue(record.value),
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
