"use client";

import { createClient } from "@/lib/supabase/client";
import {
  buildCollectionCards,
  COLLECTION_PAGE_SIZE,
  type CollectionCard,
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
  stale: false;
};

export async function loadWebCollectorCollectionPage({
  query = "",
  limit = COLLECTION_PAGE_SIZE,
}: {
  query?: string;
  limit?: number;
} = {}): Promise<WebCollectorCollectionPage> {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw new Error("Sign in again to load your collection.");

  let itemQuery = supabase
    .from("inventory_items")
    .select("id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(Math.min(Math.max(limit, 1), COLLECTION_PAGE_SIZE));

  const cleanQuery = query.trim();
  if (cleanQuery) itemQuery = itemQuery.ilike("card_name", `%${cleanQuery}%`);

  const [
    { data: items, error: itemsError },
    { data: locations, error: locationsError },
    { data: tradeStatuses },
    { data: wishlist },
  ] = await Promise.all([
    itemQuery,
    supabase
      .from("inventory_locations")
      .select("id, name, location_type, data")
      .eq("user_id", user.id)
      .order("name", { ascending: true })
      .limit(100),
    supabase
      .from("binder_card_trade_status")
      .select("inventory_item_id, status")
      .eq("user_id", user.id)
      .limit(500),
    supabase
      .from("collector_wishlist")
      .select("card_name, set_code, target_condition, target_finish")
      .eq("user_id", user.id)
      .limit(500),
  ]);

  if (itemsError) throw new Error(`Collection storage is unavailable: ${itemsError.message}`);
  if (locationsError) throw new Error(`Storage locations are unavailable: ${locationsError.message}`);

  return {
    cards: buildCollectionCards({
      items: (items ?? []) as RawInventoryItem[],
      locations: (locations ?? []) as RawInventoryLocation[],
      tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
      wishlist: (wishlist ?? []) as RawWishlistItem[],
    }),
    locations: buildWebStorageLocations((locations ?? []) as RawInventoryLocation[]),
    totalQuantity: ((items ?? []) as RawInventoryItem[]).reduce((sum: number, item: RawInventoryItem) => sum + Number(item.quantity ?? 0), 0),
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
    .select("id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data")
    .eq("user_id", user.id)
    .eq("id", cardId)
    .maybeSingle();

  if (itemError) throw new Error(`Card details are unavailable: ${itemError.message}`);
  if (!item) return { cards: [], locations: [], totalQuantity: 0, stale: false };

  const [{ data: locations }, { data: tradeStatuses }, { data: wishlist }, { data: quantityRows }] = await Promise.all([
    supabase
      .from("inventory_locations")
      .select("id, name, location_type, data")
      .eq("user_id", user.id)
      .order("name", { ascending: true })
      .limit(100),
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

  return {
    cards: buildCollectionCards({
      items: [item as RawInventoryItem],
      locations: (locations ?? []) as RawInventoryLocation[],
      tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
      wishlist: (wishlist ?? []) as RawWishlistItem[],
    }),
    locations: buildWebStorageLocations((locations ?? []) as RawInventoryLocation[]),
    totalQuantity: ((quantityRows ?? []) as Array<{ quantity?: number | null }>).reduce((sum: number, row) => sum + Number(row.quantity ?? 0), 0),
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
    return {
      id: location.id,
      name: typeof payload.name === "string" && payload.name.trim() ? payload.name : location.name ?? "Unnamed location",
      type: (location.location_type === "binder" ||
        location.location_type === "box" ||
        location.location_type === "sealed" ||
        location.location_type === "bulk" ||
        location.location_type === "custom"
        ? location.location_type
        : "unknown") as StorageLocation["type"],
      description: typeof payload.description === "string" ? payload.description : null,
      zone: typeof payload.zone === "string" ? payload.zone : null,
      binderPage: null,
      binderSlot: null,
    };
  });
}
