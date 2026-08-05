"use client";

import { createClient } from "@/lib/supabase/client";
import { buildCollectionCards, type RawInventoryItem, type RawInventoryLocation, type RawTradeBinderStatus } from "@/lib/collector-workspace";
import {
  buildTradeBinderWishlistState,
  type RawTradeBinderRow,
  type RawWishlistRow,
  type TradeStatus,
  type WishlistPriority,
} from "@/lib/trade-binder-wishlist";

export async function loadWebTradeBinderWishlist() {
  const supabase = createClient();
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error("Sign in again to load Trade Binder and Wishlist.");
  const userId = auth.user.id;
  const [{ data: items, error: itemError }, { data: locations }, { data: tradeRows }, { data: wishlistRows }] = await Promise.all([
    supabase.from("inventory_items").select("id, card_name, sku, location_id, scryfall_id, set_code, collector_number, quantity, inventory_value, updated_at, data").eq("user_id", userId).order("updated_at", { ascending: false }).limit(500),
    supabase.from("inventory_locations").select("id, name, location_type, data").eq("user_id", userId).order("name", { ascending: true }).limit(500),
    supabase.from("binder_card_trade_status").select("inventory_item_id, status, trade_value, notes, updated_at").eq("user_id", userId).limit(1000),
    supabase.from("collector_wishlist").select("id, card_name, set_code, target_condition, target_finish, target_value, priority, notes, created_at, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(1000),
  ]);
  if (itemError) throw new Error(`Collection cards are unavailable: ${itemError.message}`);
  const cards = buildCollectionCards({
    items: (items ?? []) as RawInventoryItem[],
    locations: (locations ?? []) as RawInventoryLocation[],
    tradeStatuses: (tradeRows ?? []) as RawTradeBinderStatus[],
    wishlist: (wishlistRows ?? []) as RawWishlistRow[],
  });
  return {
    userId,
    ...buildTradeBinderWishlistState({ userId, cards, tradeRows: (tradeRows ?? []) as RawTradeBinderRow[], wishlistRows: (wishlistRows ?? []) as RawWishlistRow[] }),
  };
}

export async function updateWebTradeStatus(userId: string, inventoryItemId: string, status: TradeStatus) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.id !== userId) throw new Error("You can only update your own Trade Binder.");
  const { error } = await supabase.from("binder_card_trade_status").upsert({ user_id: userId, inventory_item_id: inventoryItemId, status, updated_at: new Date().toISOString() }, { onConflict: "user_id,inventory_item_id" });
  if (error) throw new Error(error.message);
}

export async function updateWebWishlistPriority(userId: string, wishlistItemId: string, priority: WishlistPriority) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.id !== userId) throw new Error("You can only update your own Wishlist.");
  const { error } = await supabase.from("collector_wishlist").update({ priority, updated_at: new Date().toISOString() }).eq("user_id", userId).eq("id", wishlistItemId);
  if (error) throw new Error(error.message);
}

export async function addWebWishlistItem(input: {
  userId: string;
  cardName: string;
  setCode?: string | null;
  targetCondition?: string | null;
  targetFinish?: string | null;
  priority?: WishlistPriority;
  notes?: string;
}) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.id !== input.userId) throw new Error("You can only update your own Wishlist.");
  const { error } = await supabase.from("collector_wishlist").insert({
    user_id: input.userId,
    card_name: input.cardName.trim(),
    set_code: input.setCode?.trim().toUpperCase() || null,
    target_condition: input.targetCondition || null,
    target_finish: input.targetFinish || null,
    priority: input.priority ?? "medium",
    notes: input.notes?.slice(0, 500) ?? "",
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

export async function removeWebWishlistItem(userId: string, wishlistItemId: string) {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user?.id !== userId) throw new Error("You can only update your own Wishlist.");
  const { error } = await supabase.from("collector_wishlist").delete().eq("user_id", userId).eq("id", wishlistItemId);
  if (error) throw new Error(error.message);
}
