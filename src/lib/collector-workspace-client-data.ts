"use client";

import { createClient } from "@/lib/supabase/client";
import {
  buildCollectionCards,
  buildCollectionLocationPathLabel,
  buildCollectionPageInfo,
  COLLECTION_PAGE_SIZE,
  buildInventorySearchFilterExpression,
  buildInventorySearchTerms,
  decodeCollectionCursor,
  normalizeCollectionPageSize,
  type CollectionCard,
  type CollectionFilter,
  type CollectionPageInfo,
  type CollectionPageRequest,
  type CollectionSort,
  type StorageLocation,
  type RawInventoryItem,
  type RawInventoryLocation,
  type RawTradeBinderStatus,
  type RawWishlistItem,
} from "@/lib/collector-workspace";
import type { CollectorMutation } from "@/lib/collector-mutations";

export type WebCollectorCollectionPage = {
  cards: CollectionCard[];
  locations: ReturnType<typeof buildWebStorageLocations>;
  totalQuantity: number;
  pageInfo: CollectionPageInfo;
  stale: false;
};

export type WebGlobalInventorySearch = {
  items: RawInventoryItem[];
  locations: RawInventoryLocation[];
  provenance: WebInventoryProvenance[];
};

export type WebInventoryProvenance = {
  inventoryItemId: string;
  positionId: string;
  batchId: string;
  batchCode: string;
  batchTitle: string | null;
  position: number | null;
  quantity: number;
  locationId: string | null;
};

/** Search the live inventory ledger with the same filters used by Collection. */
export async function searchWebInventory(query: string, limit = 100): Promise<WebGlobalInventorySearch> {
  const supabase = createClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in again to search your inventory.");

  const filter = { query } satisfies CollectionFilter;
  const relatedFilters = await loadRelatedFilterIds(user.id, filter);
  if (relatedFilters.blocked) return { items: [], locations: [], provenance: [] };

  let itemQuery = supabase
    .from("inventory_items")
    .select("id, card_name, sku, location_id, game_id, product_type, provider_category_id, provider_product_id, provider_sku_id, tcgplayer_product_id, tcgplayer_sku_id, variant, language, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data")
    .eq("user_id", user.id)
    .order("card_name", { ascending: true })
    .order("id", { ascending: true });
  itemQuery = applyInventoryFilters(itemQuery, filter, relatedFilters);
  const [{ data: items, error: itemsError }, { data: locations, error: locationsError }] = await Promise.all([
    itemQuery.limit(Math.min(Math.max(limit, 1), 100)),
    supabase.from("inventory_locations").select("id, name, location_type, data").eq("user_id", user.id).limit(500),
  ]);
  if (itemsError) throw new Error(`Inventory search is unavailable: ${itemsError.message}`);
  if (locationsError) throw new Error(`Storage locations are unavailable: ${locationsError.message}`);
  const rawItems = (items ?? []) as RawInventoryItem[];
  const itemIds = rawItems.map((item) => item.id).filter(Boolean);
  if (!itemIds.length) return { items: rawItems, locations: (locations ?? []) as RawInventoryLocation[], provenance: [] };

  const { data: positions, error: positionsError } = await supabase
    .from("chaos_sort_inventory_positions")
    .select("id,item_id,batch_id,position,quantity,location_id")
    .eq("user_id", user.id)
    .in("item_id", itemIds)
    .gt("quantity", 0)
    .limit(500);
  if (positionsError) throw new Error(`Inventory provenance is unavailable: ${positionsError.message}`);

  const rawPositions = (positions ?? []) as Array<{
    id: string;
    item_id: string | null;
    batch_id: string;
    position: number | null;
    quantity: number | null;
    location_id: string | null;
  }>;
  const batchIds = [...new Set(rawPositions.map((position) => position.batch_id).filter(Boolean))];
  if (!batchIds.length) return { items: rawItems, locations: (locations ?? []) as RawInventoryLocation[], provenance: [] };

  const { data: batches, error: batchesError } = await supabase
    .from("chaos_sort_batches")
    .select("id,batch_code,title")
    .eq("user_id", user.id)
    .in("id", batchIds)
    .limit(500);
  if (batchesError) throw new Error(`Chaos Sort provenance is unavailable: ${batchesError.message}`);
  const batchById = new Map(
    ((batches ?? []) as Array<{ id: string; batch_code: string; title: string | null }>).map((batch) => [batch.id, batch]),
  );
  return {
    items: rawItems,
    locations: (locations ?? []) as RawInventoryLocation[],
    provenance: rawPositions.flatMap((position) => {
      const batch = batchById.get(position.batch_id);
      if (!position.item_id || !batch) return [];
      return [{
        inventoryItemId: position.item_id,
        positionId: position.id,
        batchId: batch.id,
        batchCode: batch.batch_code,
        batchTitle: batch.title,
        position: position.position,
        quantity: Math.max(0, position.quantity ?? 0),
        locationId: position.location_id,
      }];
    }),
  };
}

export async function loadWebCollectorCollectionPage({
  filter,
  sort = "recently_updated",
  cursor = null,
  limit = COLLECTION_PAGE_SIZE,
}: CollectionPageRequest = {}): Promise<WebCollectorCollectionPage> {
  const pageSize = normalizeCollectionPageSize(limit);
  const request = { filter, sort, cursor, limit: pageSize };
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in again to load your collection.");

  const relatedFilters = await loadRelatedFilterIds(user.id, filter);
  if (relatedFilters.blocked) return emptyWebPage(request);

  let itemQuery = supabase
    .from("inventory_items")
    .select("id, card_name, sku, location_id, game_id, product_type, provider_category_id, provider_product_id, provider_sku_id, tcgplayer_product_id, tcgplayer_sku_id, variant, language, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data")
    .eq("user_id", user.id);
  itemQuery = applyInventoryFilters(itemQuery, filter, relatedFilters);
  itemQuery = applyInventorySort(itemQuery, sort);
  itemQuery = applyInventoryCursor(itemQuery, sort, cursor);
  itemQuery = itemQuery.limit(pageSize + 1);

  const [
    { data: items, error: itemsError },
    { data: locations, error: locationsError },
  ] = await Promise.all([
    itemQuery,
    supabase
      .from("inventory_locations")
      .select("id, name, location_type, data")
      .eq("user_id", user.id)
      .order("name", { ascending: true })
      .limit(500),
  ]);

  if (itemsError) throw new Error(`Collection storage is unavailable: ${itemsError.message}`);
  if (locationsError) throw new Error(`Storage locations are unavailable: ${locationsError.message}`);

  const fetchedItems = (items ?? []) as RawInventoryItem[];
  const rawItems = fetchedItems.slice(0, pageSize);
  const itemIds = rawItems.map((item) => item.id).filter(Boolean);
  const cardNames = [...new Set(rawItems.map((item) => item.card_name).filter((name): name is string => typeof name === "string" && name.length > 0))];
  const [{ data: tradeStatuses }, { data: wishlist }] = await Promise.all([
    itemIds.length
      ? supabase
        .from("binder_card_trade_status")
        .select("inventory_item_id, status")
        .eq("user_id", user.id)
        .in("inventory_item_id", itemIds)
      : Promise.resolve({ data: [] }),
    cardNames.length
      ? supabase
        .from("collector_wishlist")
        .select("card_name, set_code, target_condition, target_finish")
        .eq("user_id", user.id)
        .in("card_name", cardNames)
        .limit(1000)
      : Promise.resolve({ data: [] }),
  ]);
  const cards = buildCollectionCards({
    items: rawItems,
    locations: (locations ?? []) as RawInventoryLocation[],
    tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
    wishlist: (wishlist ?? []) as RawWishlistItem[],
  });

  return {
    cards,
    locations: buildWebStorageLocations((locations ?? []) as RawInventoryLocation[]),
    totalQuantity: cards.reduce((sum: number, card) => sum + card.quantityOwned, 0),
    pageInfo: buildCollectionPageInfo({ cards, request, hasMore: fetchedItems.length > pageSize }),
    stale: false,
  };
}

export async function loadWebCollectorCardById(cardId: string): Promise<WebCollectorCollectionPage> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in again to load this card.");

  const { data: item, error: itemError } = await supabase
    .from("inventory_items")
    .select("id, card_name, sku, location_id, game_id, product_type, provider_category_id, provider_product_id, provider_sku_id, tcgplayer_product_id, tcgplayer_sku_id, variant, language, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data")
    .eq("user_id", user.id)
    .eq("id", cardId)
    .maybeSingle();

  if (itemError) throw new Error(`Card details are unavailable: ${itemError.message}`);
  if (!item) return emptyWebPage({});

  const [{ data: locations }, { data: tradeStatuses }, { data: wishlist }, { data: quantityRows }] = await Promise.all([
    supabase
      .from("inventory_locations")
      .select("id, name, location_type, data")
      .eq("user_id", user.id)
      .order("name", { ascending: true })
      .limit(500),
    supabase
      .from("binder_card_trade_status")
      .select("inventory_item_id, status")
      .eq("user_id", user.id)
      .eq("inventory_item_id", cardId)
      .limit(1),
    supabase
      .from("collector_wishlist")
      .select("card_name, set_code, target_condition, target_finish")
      .eq("user_id", user.id)
      .limit(500),
    supabase
      .from("inventory_items")
      .select("quantity")
      .eq("user_id", user.id)
      .limit(1000),
  ]);

  const cards = buildCollectionCards({
    items: [item as RawInventoryItem],
    locations: (locations ?? []) as RawInventoryLocation[],
    tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
    wishlist: (wishlist ?? []) as RawWishlistItem[],
  });

  return {
    cards,
    locations: buildWebStorageLocations((locations ?? []) as RawInventoryLocation[]),
    totalQuantity: ((quantityRows ?? []) as Array<{ quantity?: number | null }>).reduce((sum: number, row) => sum + Number(row.quantity ?? 0), 0),
    pageInfo: buildCollectionPageInfo({ cards, request: {} }),
    stale: false,
  };
}

export async function runWebCollectorMutation(mutation: CollectorMutation) {
  const response = await fetch("/api/collector-workspace/mutations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mutation),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Collection update failed.");
  return payload;
}

function buildWebStorageLocations(locations: RawInventoryLocation[]): StorageLocation[] {
  return locations.map((location) => {
    const payload = location.data ?? {};
    const name = typeof payload.name === "string" && payload.name.trim() ? payload.name : location.name ?? "Unnamed location";
    return {
      id: location.id,
      name,
      type: (location.location_type === "binder" ||
        location.location_type === "box" ||
        location.location_type === "sealed" ||
        location.location_type === "bulk" ||
        location.location_type === "custom"
        ? location.location_type
        : "unknown") as StorageLocation["type"],
      parentId: typeof payload.parentId === "string" && payload.parentId.trim() ? payload.parentId : null,
      pathLabel: buildCollectionLocationPathLabel(location.id, locations),
      description: typeof payload.description === "string" ? payload.description : null,
      zone: typeof payload.zone === "string" ? payload.zone : null,
      binderPage: null,
      binderSlot: null,
    };
  });
}

async function loadRelatedFilterIds(userId: string, filter?: CollectionFilter) {
  const supabase = createClient();
  const tradeStatus = filter?.tradeBinderStatus;
  const wishlistStatus = filter?.wishlistStatus;
  const query = filter?.query?.trim() ?? "";
  const [tradeResult, wishlistResult, locationResult] = await Promise.all([
    tradeStatus && tradeStatus !== "all"
      ? supabase
        .from("binder_card_trade_status")
        .select("inventory_item_id")
        .eq("user_id", userId)
        .in("status", tradeStatus === "tradeable"
          ? ["available", "reserved", "pending", "looking_for_upgrade", "for_sale"]
          : [tradeStatus])
        .limit(1000)
      : Promise.resolve({ data: null, error: null }),
    wishlistStatus && wishlistStatus !== "all"
      ? supabase
        .from("collector_wishlist")
        .select("card_name")
        .eq("user_id", userId)
        .limit(1000)
      : Promise.resolve({ data: null, error: null }),
    query
      ? supabase
        .from("inventory_locations")
        .select("id, name, location_type, data")
        .eq("user_id", userId)
        .limit(500)
      : Promise.resolve({ data: null, error: null }),
  ]);

  if (tradeResult.error) throw new Error(`Trade Binder filters are unavailable: ${tradeResult.error.message}`);
  if (wishlistResult.error) throw new Error(`Wishlist filters are unavailable: ${wishlistResult.error.message}`);
  if (locationResult.error) throw new Error(`Storage location search is unavailable: ${locationResult.error.message}`);

  const tradeIds = tradeStatus && tradeStatus !== "all"
    ? (tradeResult.data ?? [])
      .map((row: { inventory_item_id?: string | null }) => row.inventory_item_id)
      .filter((id: string | null | undefined): id is string => typeof id === "string" && id.length > 0)
    : null;
  const wishlistNames = wishlistStatus === "wanted"
    ? [...new Set((wishlistResult.data ?? [])
      .map((row: { card_name?: string | null }) => row.card_name)
      .filter((name: string | null | undefined): name is string => typeof name === "string" && name.length > 0))]
    : null;
  const locationIds = query
    ? matchingLocationIds((locationResult.data ?? []) as RawInventoryLocation[], query)
    : null;

  return {
    blocked: Boolean((tradeIds && tradeIds.length === 0) || (wishlistNames && wishlistNames.length === 0)),
    tradeIds,
    wishlistNames,
    locationIds,
  };
}

function applyInventoryFilters(query: InventoryQuery, filter: CollectionFilter | undefined, related: Awaited<ReturnType<typeof loadRelatedFilterIds>>) {
  // Zero-quantity rows remain in the ledger-backed table for history, but are
  // no longer active owned inventory and must not appear in this workspace.
  let next = query.gt("quantity", 0);
  const cleanQuery = filter?.query?.trim();
  if (cleanQuery) {
    const locationFilter = "locationIds" in related && related.locationIds?.length
      ? `,location_id.in.(${related.locationIds.map(encodeSupabaseListValue).join(",")})`
      : "";
    for (const term of buildInventorySearchTerms(cleanQuery)) {
      next = next.or(`${buildInventorySearchFilterExpression(term)}${locationFilter}`);
    }
  }
  if (filter?.gameId && filter.gameId !== "all") {
    next = filter.gameId === "magic"
      ? next.or("game_id.eq.magic,game_id.is.null")
      : next.eq("game_id", filter.gameId);
  }
  if (filter?.productType && filter.productType !== "all") {
    next = filter.productType === "card"
      ? next.or("product_type.eq.card,product_type.is.null")
      : next.eq("product_type", filter.productType);
  }
  if (filter?.condition && filter.condition !== "all") next = next.eq("data->>condition", filter.condition);
  if (filter?.finish && filter.finish !== "all") next = next.eq("data->>finish", filter.finish);
  if (filter?.setCode && filter.setCode !== "all") next = next.or(`set_code.eq.${filter.setCode},data->>set.eq.${filter.setCode}`);
  if (filter?.storageLocationId && filter.storageLocationId !== "all") next = next.eq("location_id", filter.storageLocationId);
  if ("tradeIds" in related && related.tradeIds) next = next.in("id", related.tradeIds);
  if ("wishlistNames" in related && related.wishlistNames) next = next.in("card_name", related.wishlistNames);
  return next;
}

function matchingLocationIds(locations: RawInventoryLocation[], query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return [];
  const terms = buildInventorySearchTerms(normalized);
  const byParent = new Map<string, string[]>();
  for (const location of locations) {
    const parentId = typeof location.data?.parentId === "string" ? location.data.parentId : null;
    if (!parentId) continue;
    const children = byParent.get(parentId) ?? [];
    children.push(location.id);
    byParent.set(parentId, children);
  }
  const directMatches = locations.filter((location) => {
    const path = buildCollectionLocationPathLabel(location.id, locations) ?? "";
    const haystack = `${location.name ?? ""} ${path} ${location.location_type ?? ""}`.toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
  const ids = new Set<string>();
  for (const location of directMatches) {
    ids.add(location.id);
    const queue = [location.id];
    while (queue.length) {
      const current = queue.shift() as string;
      for (const childId of byParent.get(current) ?? []) {
        if (ids.has(childId)) continue;
        ids.add(childId);
        queue.push(childId);
      }
    }
  }
  return [...ids];
}

function encodeSupabaseListValue(value: string) {
  return `"${value.replace(/"/g, '\\"')}"`;
}

function applyInventorySort(query: InventoryQuery, sort: CollectionSort) {
  if (sort === "name_asc") return query.order("card_name", { ascending: true }).order("id", { ascending: true });
  if (sort === "name_desc") return query.order("card_name", { ascending: false }).order("id", { ascending: true });
  if (sort === "quantity_desc") return query.order("quantity", { ascending: false }).order("id", { ascending: true });
  if (sort === "set_asc") return query.order("set_code", { ascending: true }).order("collector_number", { ascending: true }).order("id", { ascending: true });
  if (sort === "price_desc") return query.order("inventory_value", { ascending: false }).order("id", { ascending: true });
  return query.order("updated_at", { ascending: false }).order("id", { ascending: true });
}

function applyInventoryCursor(query: InventoryQuery, sort: CollectionSort, cursor?: string | null) {
  const decoded = decodeCollectionCursor(cursor);
  if (!decoded || decoded.sort !== sort) return query;
  const value = decoded.value;
  if (sort === "name_asc") return query.or(`card_name.gt.${value},and(card_name.eq.${value},id.gt.${decoded.id})`);
  if (sort === "name_desc") return query.or(`card_name.lt.${value},and(card_name.eq.${value},id.gt.${decoded.id})`);
  if (sort === "quantity_desc") return query.or(`quantity.lt.${value},and(quantity.eq.${value},id.gt.${decoded.id})`);
  if (sort === "price_desc") return query.or(`inventory_value.lt.${value},and(inventory_value.eq.${value},id.gt.${decoded.id})`);
  if (sort === "set_asc") return query.gt("id", decoded.id);
  return query.or(`updated_at.lt.${value},and(updated_at.eq.${value},id.gt.${decoded.id})`);
}

function emptyWebPage(request: CollectionPageRequest): WebCollectorCollectionPage {
  const cards: CollectionCard[] = [];
  return {
    cards,
    locations: [],
    totalQuantity: 0,
    pageInfo: buildCollectionPageInfo({ cards, request }),
    stale: false,
  };
}

type InventoryQuery = {
  eq(column: string, value: unknown): InventoryQuery;
  gt(column: string, value: unknown): InventoryQuery;
  in(column: string, values: unknown[]): InventoryQuery;
  limit(count: number): InventoryQuery;
  or(filters: string): InventoryQuery;
  order(column: string, options?: { ascending?: boolean }): InventoryQuery;
};
