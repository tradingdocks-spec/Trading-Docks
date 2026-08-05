"use client";

import { createClient } from "@/lib/supabase/client";
import {
  buildCollectionCards,
  COLLECTION_PAGE_SIZE,
  type CollectionCard,
  type RawInventoryItem,
  type RawInventoryLocation,
  type RawTradeBinderStatus,
  type RawWishlistItem,
} from "@/lib/collector-workspace";

export type WebCollectorCollectionPage = {
  cards: CollectionCard[];
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
  if (!item) return { cards: [], stale: false };

  const locationId = locationIdForItem(item as RawInventoryItem);
  const [{ data: locations }, { data: tradeStatuses }, { data: wishlist }] = await Promise.all([
    locationId
      ? supabase
          .from("inventory_locations")
          .select("id, name, location_type, data")
          .eq("user_id", user.id)
          .eq("id", locationId)
          .limit(1)
      : Promise.resolve({ data: [] }),
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
  ]);

  return {
    cards: buildCollectionCards({
      items: [item as RawInventoryItem],
      locations: (locations ?? []) as RawInventoryLocation[],
      tradeStatuses: (tradeStatuses ?? []) as RawTradeBinderStatus[],
      wishlist: (wishlist ?? []) as RawWishlistItem[],
    }),
    stale: false,
  };
}

function locationIdForItem(item: RawInventoryItem) {
  const payload = item.data ?? {};
  return typeof payload.locationId === "string"
    ? payload.locationId
    : item.location_id ?? null;
}
