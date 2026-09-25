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
import { persistInventoryBatch, deliverInventoryBatch, INVENTORY_BATCH_QUEUE_TYPE } from '../../mobile/services/inventory-command-batch';
import { collectorEditQueue } from '@/lib/collector-edit-queue';
import { isDurableCollectorEdit, persistCollectorEdit, deliverCollectorEdit, collectorEditCommand } from '../../mobile/services/collector-inventory-command';
import { COLLECTION_MUTATION_QUEUE_TYPE } from '@/lib/collector-mutations';
import type { CollectorMutation } from "@/lib/collector-mutations";
import { ownedInventoryQuery } from "@/lib/owned-inventory-query";
import { currentInventoryWorkspace } from "@/lib/inventory-workspace";
import { searchOwnedInventory } from "@/lib/owned-inventory-search";

export type WebCollectorCollectionPage = {
  workspaceId?: string;
  cards: CollectionCard[];
  locations: ReturnType<typeof buildWebStorageLocations>;
  totalQuantity: number;
  pageInfo: CollectionPageInfo;
  stale: false;
};

export type { WebGlobalInventorySearch, WebInventoryProvenance } from "@/lib/owned-inventory-search";

export async function searchWebInventory(query: string, limit = 100) {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in again to search your inventory.");
  return searchOwnedInventory(supabase, user.id, query, limit);
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

  const workspaceId = await currentInventoryWorkspace(supabase);
  let itemQuery = ownedInventoryQuery(supabase, user.id, workspaceId);
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
    workspaceId,
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
  if (isDurableCollectorEdit(mutation)) {
    const original = structuredClone(mutation);
    const operationId = mutation.operationId ?? crypto.randomUUID();
    const transport = collectorEditTransport();
    const context = await transport.context();
    const queue = collectorEditQueue();
    await persistCollectorEdit(queue, original, operationId, context);
    const result = await deliverCollectorEdit(queue, operationId, original.userId, transport);
    if (!result.committed) throw new Error(`Edit ${operationId} is preserved for recovery. ${result.operation?.lastError ?? 'Delivery was not confirmed.'}`);
    return { ok: true, operationId };
  }
  const response = await fetch("/api/collector-workspace/mutations", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(mutation),
  });
  const payload = await response.json().catch(() => ({})) as { error?: string };
  if (!response.ok) throw new Error(payload.error ?? "Collection update failed.");
  return payload;
}

export function collectorEditTransport() {
  const client = createClient();
  return {
    context: async () => {
      const { data: { user }, error } = await client.auth.getUser();
      if (error || !user) throw new Error('AUTHORIZATION_FAILURE: sign in again.');
      return { userId: user.id, workspaceId: await currentInventoryWorkspace(client) };
    },
    rpc: async (endpoint: import('../../mobile/services/inventory-command').InventoryCommand['endpoint'] | 'apply_inventory_manifest', args: Record<string, unknown>) => {
      const response = await fetch('/api/collector-workspace/mutations', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ command: { endpoint, args } }),
      });
      const payload = await response.json() as { data?: unknown; error?: { message: string; code?: string } | string };
      if (!response.ok || payload.error) return { data: null, error: typeof payload.error === 'object' ? payload.error : { message: payload.error ?? 'Edit acknowledgement unavailable.', code: String(response.status) } };
      return { data: payload.data, error: null };
    },
  };
}

/** Capture selected quantities once, before any removal request. */
export async function removeWebCollectorBatch(cards: Array<{ id: string; quantity: number }>, userId: string) {
  const transport = collectorEditTransport(), context = await transport.context(), queue = collectorEditQueue();
  if (context.userId !== userId) throw Error('AUTHORIZATION_FAILURE');
  const id = crypto.randomUUID(), createdAt = new Date().toISOString();
  const commands = cards.filter(c => c.quantity > 0).map(c => collectorEditCommand({ type: 'remove_quantity', userId,
    inventoryItemId: c.id, quantity: c.quantity, reason: 'Bulk remove from collection' }, `${id}:${c.id}`, context.workspaceId, createdAt));
  await persistInventoryBatch(queue, id, commands, 'bulk_remove');
  const result = await deliverInventoryBatch(queue, id, userId, transport);
  if (!result.committed) throw Error(`Removal is not fully acknowledged. Earlier rows may have completed. Recover saved operation ${id}; do not start a new removal.`);
}

/** Explicit recovery resends persisted commands; never reconstructs them from current UI values. */
export async function retryWebCollectorEdits(userId: string) {
  const queue = collectorEditQueue();
  const transport = collectorEditTransport();
  const context = await transport.context();
  if (context.userId !== userId) throw new Error('AUTHORIZATION_FAILURE');
  for (const operation of await queue.list()) {
    if (operation.userId !== userId) continue;
    if (operation.type === INVENTORY_BATCH_QUEUE_TYPE) { await deliverInventoryBatch(queue, operation.id, userId, transport); continue; }
    if (operation.type !== COLLECTION_MUTATION_QUEUE_TYPE || !operation.payload.command) continue;
    await deliverCollectorEdit(queue, operation.id, userId, transport);
  }
  return (await queue.list()).filter((operation) => operation.userId === userId && [COLLECTION_MUTATION_QUEUE_TYPE, INVENTORY_BATCH_QUEUE_TYPE].includes(operation.type));
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
