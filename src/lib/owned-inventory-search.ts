import type { RawInventoryItem, RawInventoryLocation } from "../../mobile/services/collector-workspace.ts";
import { ownedInventoryQuery, readOwnedInventoryPage } from "./owned-inventory-query.ts";
import { loadInventoryProvenance, matchesInventorySearch, type InventoryProvenance } from "./inventory-provenance.ts";

export type WebGlobalInventorySearch = {
  items: RawInventoryItem[];
  locations: RawInventoryLocation[];
  provenance: WebInventoryProvenance[];
};

export type WebInventoryProvenance = {
  inventoryItemId: string;
  positionId: string;
  batchId: string | null;
  batchCode: string | null;
  batchTitle: string | null;
  position: number | null;
  quantity: number;
  locationId: string | null;
};

/** Uses the caller's authenticated RLS client. No service-role or alternate index. */
export async function searchOwnedInventory(supabase: { from(table: string): any }, userId: string, query: string, limit = 100): Promise<WebGlobalInventorySearch> {
  if (!userId) throw new Error("Authenticated inventory owner required.");
  const { data: locations, error: locationsError } = await supabase.from("inventory_locations")
    .select("id, name, location_type, data").eq("user_id", userId).limit(500);
  if (locationsError) throw new Error(`Storage locations are unavailable: ${locationsError.message}`);
  const rawLocations = (locations ?? []) as RawInventoryLocation[];
  const locationById = new Map(rawLocations.map((location) => [location.id, location]));
  const matchingLocations = rawLocations.filter(location => matchesInventorySearch([location.name, location.location_type, location.data?.zone], query)).map(location => location.id);
  const selectedItems: RawInventoryItem[] = [];
  const selectedProvenance: InventoryProvenance[] = [];
  const resultLimit = Math.min(Math.max(limit, 1), 100);
  // Page the same active owner ledger as Collection. Never put the entire library
  // in one PostgREST URL, or silently stop at the hosted server's row cap.
  for (let offset = 0; ; offset += 250) {
    const rawItems = await readOwnedInventoryPage(supabase, userId, offset, query, matchingLocations) as RawInventoryItem[];
    const provenance = await loadInventoryProvenance(supabase, userId, rawItems.map((item) => item.id));
    for (const item of rawItems) {
      const positions = provenance.filter((position) => position.inventoryItemId === item.id);
      const itemMatches = inventoryItemMatchesQuery(item, query) || matchingLocations.includes(item.location_id ?? "");
      const matchingPositions = positions.filter((position) => itemMatches || provenanceMatchesQuery(position, locationById, query));
      if (!itemMatches && !matchingPositions.length) continue;
      selectedItems.push(item);
      selectedProvenance.push(...matchingPositions);
      if (selectedItems.length === resultLimit) break;
    }
    if (selectedItems.length === resultLimit || rawItems.length < 250) break;
  }
  // Batch names/codes belong to provenance, not the inventory item. Resolve
  // these separately with bounded joins, without scanning the whole library.
  if (query.trim() && selectedItems.length < resultLimit) {
    for (let offset = 0; selectedItems.length < resultLimit; offset += 250) {
      const batches = await supabase.from("chaos_sort_batches").select("id,batch_code,title")
        .eq("user_id", userId).order("id", { ascending: true }).range(offset, offset + 249);
      if (batches.error) throw new Error(`Inventory batch search is unavailable: ${batches.error.message}`);
      const matching = (batches.data ?? []).filter((b: { batch_code?: string; title?: string }) => matchesInventorySearch([b.batch_code, b.title], query));
      for (let start = 0; start < matching.length; start += 50) {
        for (let positionOffset = 0; selectedItems.length < resultLimit; positionOffset += 250) {
          const positions = await supabase.from("chaos_sort_inventory_positions").select("item_id,id")
            .eq("user_id", userId).gt("quantity", 0).in("batch_id", matching.slice(start, start + 50).map((b: { id: string }) => b.id))
            .order("id", { ascending: true }).range(positionOffset, positionOffset + 249);
          if (positions.error) throw new Error(`Inventory position search is unavailable: ${positions.error.message}`);
          const ids = [...new Set<string>((positions.data ?? []).map((p: { item_id: string }) => p.item_id))];
          for (let itemOffset = 0; itemOffset < ids.length && selectedItems.length < resultLimit; itemOffset += 25) {
            const items = await ownedInventoryQuery(supabase, userId).in("id", ids.slice(itemOffset, itemOffset + 25)).order("id").limit(25);
            if (items.error) throw new Error(`Inventory batch items are unavailable: ${items.error.message}`);
            const unseen = (items.data ?? []).filter((item: RawInventoryItem) => !selectedItems.some(selected => selected.id === item.id)).slice(0, resultLimit - selectedItems.length);
            const provenance = await loadInventoryProvenance(supabase, userId, unseen.map((item: RawInventoryItem) => item.id));
            selectedItems.push(...unseen);
            selectedProvenance.push(...provenance.filter(p => provenanceMatchesQuery(p, locationById, query)));
          }
          if ((positions.data ?? []).length < 250) break;
        }
      }
      if ((batches.data ?? []).length < 250) break;
    }
  }
  return { items: selectedItems, locations: rawLocations, provenance: selectedProvenance };
}

function inventoryItemMatchesQuery(item: RawInventoryItem, query: string) {
  const payload = item.data ?? {};
  return matchesInventorySearch([item.card_name, payload.name, item.sku, item.set_code, payload.set, payload.setName, item.collector_number, payload.collectorNumber, item.language, payload.language, payload.condition, payload.finish], query);
}

function provenanceMatchesQuery(position: InventoryProvenance, locationById: Map<string, RawInventoryLocation>, query: string) {
  const location = position.locationId ? locationById.get(position.locationId) : undefined;
  const locationData = location?.data ?? {};
  return matchesInventorySearch([position.condition, position.finish, position.language, position.batchCode, position.batchTitle, location?.name, location?.location_type, locationData.name, locationData.zone], query);
}
