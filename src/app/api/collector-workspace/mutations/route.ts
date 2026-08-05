import { NextResponse } from "next/server";

import { getMembershipPlan } from "@/lib/membership-catalog";
import { validateCollectorMutation, type CollectorMutation } from "@/lib/collector-mutations";
import { createClient } from "@/lib/supabase/server";
import { resolveServerAccess } from "@/lib/identity/server-access";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const mutation = await request.json().catch(() => null) as CollectorMutation | null;
  if (!mutation || typeof mutation !== "object") {
    return NextResponse.json({ error: "Choose a supported collection update." }, { status: 400 });
  }

  const itemResult = await supabase
    .from("inventory_items")
    .select("id,user_id,quantity,data,card_name,set_code,location_id")
    .eq("user_id", user.id)
    .eq("id", mutation.inventoryItemId)
    .maybeSingle();

  if (itemResult.error) return NextResponse.json({ error: itemResult.error.message }, { status: 500 });
  if (!itemResult.data) return NextResponse.json({ error: "Collection record not found." }, { status: 404 });

  const [{ data: quantityRows, error: quantityError }, access] = await Promise.all([
    supabase.from("inventory_items").select("quantity").eq("user_id", user.id).limit(1000),
    resolveServerAccess(supabase, user),
  ]);
  if (quantityError) return NextResponse.json({ error: quantityError.message }, { status: 500 });

  const currentTotalQuantity = (quantityRows ?? []).reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
  const currentCardQuantity = Number(itemResult.data.quantity ?? 0);
  const validation = validateCollectorMutation(mutation, {
    membershipTier: access.membershipTier,
    currentTotalQuantity,
    currentCardQuantity,
    requestedUserId: mutation.userId,
    authenticatedUserId: user.id,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason, code: validation.code }, {
      status: validation.code === "unauthorized" ? 403 : 400,
    });
  }

  try {
    await executeMutation(supabase, user.id, mutation, isRecord(itemResult.data.data) ? itemResult.data.data : {});
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Collection update failed." }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    limits: getMembershipPlan(access.membershipTier).limits,
  });
}

async function executeMutation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mutation: CollectorMutation,
  existingData: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  if (mutation.type === "quantity") {
    const { error } = await supabase
      .from("inventory_items")
      .update({ quantity: mutation.quantity, updated_at: now })
      .eq("user_id", userId)
      .eq("id", mutation.inventoryItemId);
    if (error) throw new Error(error.message);
    return;
  }

  if (mutation.type === "condition" || mutation.type === "finish") {
    const { error } = await supabase
      .from("inventory_items")
      .update({
        data: {
          ...existingData,
          [mutation.type]: mutation.type === "condition" ? mutation.condition : mutation.finish,
        },
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("id", mutation.inventoryItemId);
    if (error) throw new Error(error.message);
    return;
  }

  if (mutation.type === "storage") {
    if (mutation.storageLocationId) {
      const { data: location, error: locationError } = await supabase
        .from("inventory_locations")
        .select("id")
        .eq("user_id", userId)
        .eq("id", mutation.storageLocationId)
        .maybeSingle();
      if (locationError) throw new Error(locationError.message);
      if (!location) throw new Error("Choose one of your storage locations.");
    }
    const { error } = await supabase
      .from("inventory_items")
      .update({
        location_id: mutation.storageLocationId,
        data: { ...existingData, locationId: mutation.storageLocationId },
        updated_at: now,
      })
      .eq("user_id", userId)
      .eq("id", mutation.inventoryItemId);
    if (error) throw new Error(error.message);
    return;
  }

  if (mutation.type === "trade_binder_status") {
    const { error } = await supabase
      .from("binder_card_trade_status")
      .upsert({
        user_id: userId,
        inventory_item_id: mutation.inventoryItemId,
        status: mutation.status,
        updated_at: now,
      }, { onConflict: "user_id,inventory_item_id" });
    if (error) throw new Error(error.message);
    return;
  }

  if (mutation.type === "wishlist") {
    if (mutation.wishlisted) {
      const existing = await matchingWishlistQuery(supabase, userId, mutation).select("id").maybeSingle();
      if (existing.error) throw new Error(existing.error.message);
      if (existing.data) {
        const { error } = await supabase
          .from("collector_wishlist")
          .update({ updated_at: now })
          .eq("id", existing.data.id)
          .eq("user_id", userId);
        if (error) throw new Error(error.message);
        return;
      }
      const { error } = await supabase
        .from("collector_wishlist")
        .insert({
          user_id: userId,
          card_name: mutation.cardName,
          set_code: mutation.setCode ?? null,
          target_condition: mutation.condition,
          target_finish: mutation.finish,
          updated_at: now,
        });
      if (error) throw new Error(error.message);
      return;
    }
    let deleteQuery = supabase
      .from("collector_wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("card_name", mutation.cardName)
      .eq("target_condition", mutation.condition)
      .eq("target_finish", mutation.finish);
    deleteQuery = mutation.setCode ? deleteQuery.eq("set_code", mutation.setCode) : deleteQuery.is("set_code", null);
    const { error } = await deleteQuery;
    if (error) throw new Error(error.message);
  }
}

function matchingWishlistQuery(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  mutation: Extract<CollectorMutation, { type: "wishlist" }>,
) {
  let query = supabase
    .from("collector_wishlist")
    .select("*")
    .eq("user_id", userId)
    .eq("card_name", mutation.cardName)
    .eq("target_condition", mutation.condition)
    .eq("target_finish", mutation.finish);
  query = mutation.setCode ? query.eq("set_code", mutation.setCode) : query.is("set_code", null);
  return query;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
