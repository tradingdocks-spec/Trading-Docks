import type { SupabaseClient } from "@supabase/supabase-js";

import { calculateAvailableQuantity } from "./allocation.ts";

export type SellableInventoryFilters = {
  query?: string;
  setCode?: string;
  condition?: string;
  finish?: string;
  language?: string;
  locationId?: string;
  batchId?: string;
  listingState?: "available" | "allocated" | "all";
};

export type SellableInventoryRow = {
  inventoryItemId: string;
  inventoryPositionId: string | null;
  cardName: string;
  scryfallId: string | null;
  gameId: string | null;
  setCode: string | null;
  collectorNumber: string | null;
  condition: string | null;
  finish: string | null;
  language: string | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  marketValue: number | null;
  costBasis: number | null;
  locationId: string | null;
  inventoryBatchId: string | null;
  sourceProvenance: Record<string, unknown>;
};

export type SellableInventoryPage = {
  rows: SellableInventoryRow[];
  hasMore: boolean;
  page: number;
  pageSize: number;
};

type JsonRecord = Record<string, unknown>;
const PAGE_SIZE = 40;

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : typeof value === "string" && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;
}

function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function loadSellableInventoryPage({
  supabase,
  userId,
  workspaceId,
  filters = {},
  page = 1,
  pageSize = PAGE_SIZE,
}: {
  supabase: SupabaseClient;
  userId: string;
  workspaceId: string;
  filters?: SellableInventoryFilters;
  page?: number;
  pageSize?: number;
}): Promise<SellableInventoryPage> {
  const safePage = Math.max(1, Math.floor(page));
  const safePageSize = Math.min(100, Math.max(10, Math.floor(pageSize)));
  let query = supabase
    .from("inventory_items")
    .select("id,card_name,game_id,scryfall_id,set_code,collector_number,location_id,quantity,inventory_value,data,updated_at")
    .eq("user_id", userId)
    .order("card_name", { ascending: true })
    .order("id", { ascending: true });
  if (filters.query?.trim()) query = query.ilike("card_name", `%${escapeLike(filters.query.trim())}%`);
  if (filters.setCode?.trim()) query = query.eq("set_code", filters.setCode.trim());
  if (filters.locationId?.trim()) query = query.eq("location_id", filters.locationId.trim());
  const from = (safePage - 1) * safePageSize;
  const { data: items, error: itemError } = await query.range(from, from + safePageSize);
  if (itemError) throw new Error(`Sellable inventory is unavailable: ${itemError.message}`);

  const inventoryItems = (items ?? []) as Array<JsonRecord & { id: string; card_name: string; quantity: number; data?: JsonRecord | null }>;
  const itemIds = inventoryItems.map((item) => item.id);
  if (!itemIds.length) return { rows: [], hasMore: false, page: safePage, pageSize: safePageSize };

  const [{ data: positions, error: positionError }, { data: allocations, error: allocationError }] = await Promise.all([
    supabase.from("chaos_sort_inventory_positions").select("id,item_id,batch_id,card_name,scryfall_id,set_code,collector_number,finish,condition,language,quantity,location_id").eq("user_id", userId).in("item_id", itemIds).gt("quantity", 0).order("position", { ascending: true }).limit(safePageSize * 5),
    supabase.from("selling_inventory_allocations").select("inventory_item_id,inventory_position_id,quantity,status").eq("user_id", userId).eq("workspace_id", workspaceId).in("inventory_item_id", itemIds).in("status", ["ALLOCATED", "RESERVED"]).limit(safePageSize * 20),
  ]);
  if (positionError) throw new Error(`Physical positions are unavailable: ${positionError.message}`);
  if (allocationError) throw new Error(`Selling allocations are unavailable: ${allocationError.message}`);

  const rowsByItem = new Map(inventoryItems.map((item) => [item.id, item]));
  const allocationsByKey = new Map<string, number>();
  for (const allocation of allocations ?? []) {
    const itemId = stringValue(allocation.inventory_item_id);
    if (!itemId) continue;
    const key = `${itemId}:${stringValue(allocation.inventory_position_id) ?? "item"}`;
    allocationsByKey.set(key, (allocationsByKey.get(key) ?? 0) + Number(allocation.quantity ?? 0));
  }

  const positionItemIds = new Set((positions ?? []).map((position) => stringValue(position.item_id)).filter((id): id is string => Boolean(id)));
  const result: SellableInventoryRow[] = [];
  for (const position of positions ?? []) {
    const itemId = stringValue(position.item_id);
    const base = itemId ? rowsByItem.get(itemId) : undefined;
    if (!itemId || !base) continue;
    const data = (base.data ?? {}) as JsonRecord;
    const key = `${itemId}:${position.id}`;
    const reservedQuantity = allocationsByKey.get(key) ?? 0;
    const physicalQuantity = Number(position.quantity ?? 0);
    const row = toSellableRow({ base, data, position, physicalQuantity, reservedQuantity });
    if (filters.batchId && row.inventoryBatchId !== filters.batchId) continue;
    if (filters.condition && row.condition !== filters.condition) continue;
    if (filters.finish && row.finish !== filters.finish) continue;
    if (filters.language && row.language !== filters.language) continue;
    if (filters.listingState === "available" && row.availableQuantity < 1) continue;
    if (filters.listingState === "allocated" && row.reservedQuantity < 1) continue;
    result.push(row);
  }
  for (const base of inventoryItems) {
    if (positionItemIds.has(base.id)) continue;
    const data = (base.data ?? {}) as JsonRecord;
    const reservedQuantity = allocationsByKey.get(`${base.id}:item`) ?? 0;
    const row = toSellableRow({ base, data, position: null, physicalQuantity: Number(base.quantity ?? 0), reservedQuantity });
    if (filters.batchId && row.inventoryBatchId !== filters.batchId) continue;
    if (filters.condition && row.condition !== filters.condition) continue;
    if (filters.finish && row.finish !== filters.finish) continue;
    if (filters.language && row.language !== filters.language) continue;
    if (filters.listingState === "available" && row.availableQuantity < 1) continue;
    if (filters.listingState === "allocated" && row.reservedQuantity < 1) continue;
    result.push(row);
  }
  return { rows: result.slice(0, safePageSize), hasMore: inventoryItems.length > safePageSize || result.length > safePageSize, page: safePage, pageSize: safePageSize };
}

function toSellableRow({ base, data, position, physicalQuantity, reservedQuantity }: { base: JsonRecord & { id: string; card_name: string }; data: JsonRecord; position: JsonRecord | null; physicalQuantity: number; reservedQuantity: number }): SellableInventoryRow {
  const rowData = position ?? data;
  return {
    inventoryItemId: base.id,
    inventoryPositionId: position ? stringValue(position.id) : null,
    cardName: stringValue(position?.card_name) ?? base.card_name,
    scryfallId: stringValue(position?.scryfall_id) ?? stringValue(base.scryfall_id),
    gameId: stringValue(base.game_id) ?? stringValue(data.game_id),
    setCode: stringValue(position?.set_code) ?? stringValue(base.set_code) ?? stringValue(data.set_code),
    collectorNumber: stringValue(position?.collector_number) ?? stringValue(base.collector_number) ?? stringValue(data.collector_number),
    condition: stringValue(position?.condition) ?? stringValue(data.condition),
    finish: stringValue(position?.finish) ?? stringValue(data.finish),
    language: stringValue(position?.language) ?? stringValue(base.language) ?? stringValue(data.language),
    quantity: physicalQuantity,
    reservedQuantity,
    availableQuantity: calculateAvailableQuantity({ physicalQuantity, activeReservations: reservedQuantity }),
    marketValue: numberValue(data.market_price) ?? numberValue(base.inventory_value),
    costBasis: numberValue(data.cost_basis) ?? numberValue(data.unit_cost),
    locationId: stringValue(position?.location_id) ?? stringValue(base.location_id) ?? stringValue(data.location_id),
    inventoryBatchId: stringValue(position?.batch_id) ?? stringValue(data.batch_id),
    sourceProvenance: {
      ...(typeof data.source === "string" ? { source: data.source } : {}),
      ...(stringValue(data.batch_code) ? { batchCode: stringValue(data.batch_code) } : {}),
      ...(stringValue(data.session_id) ? { sessionId: stringValue(data.session_id) } : {}),
      ...(stringValue(rowData.id) ? { physicalRecordId: stringValue(rowData.id) } : {}),
    },
  };
}

export async function createSellingListingBatch({
  supabase,
  workspaceId,
  name,
  source,
  candidates,
}: {
  supabase: SupabaseClient;
  workspaceId: string;
  name: string;
  source: string;
  candidates: SellableInventoryRow[];
}) {
  if (!candidates.length) throw new Error("Select at least one available inventory position.");
  const { data, error } = await supabase.rpc("create_selling_listing_batch", {
    p_workspace_id: workspaceId,
    p_name: name,
    p_source: source,
    p_candidates: candidates.map((candidate) => ({
      inventoryItemId: candidate.inventoryItemId,
      inventoryPositionId: candidate.inventoryPositionId,
      inventoryBatchId: candidate.inventoryBatchId,
      locationId: candidate.locationId,
      quantity: candidate.availableQuantity,
      cardName: candidate.cardName,
      gameId: candidate.gameId,
      setCode: candidate.setCode,
      collectorNumber: candidate.collectorNumber,
      condition: candidate.condition,
      finish: candidate.finish,
      language: candidate.language,
      marketPrice: candidate.marketValue,
      costBasis: candidate.costBasis,
      sourceProvenance: candidate.sourceProvenance,
      imageSource: "catalog_reference",
    })),
  });
  if (error) throw new Error(error.message);
  return data;
}
