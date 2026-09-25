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

  const body = await request.json().catch(() => null);
  if (body?.command) {
    const { endpoint, args } = body.command;
    if (endpoint === 'apply_inventory_manifest') {
      const access = await resolveServerAccess(supabase, user);
      if (access.isSuspended) return NextResponse.json({ error: { message: 'AUTHORIZATION_FAILURE', code: '42501' } }, { status: 403 });
      const { data, error } = await supabase.rpc(endpoint, args ?? {});
      if (error) return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: /IDEMPOTENCY_CONFLICT/.test(error.message) ? 409 : 400 });
      return NextResponse.json({ data });
    }

    if (!['apply_collector_inventory_mutation', 'remove_inventory_lot_quantity', 'move_inventory_lot_quantity', 'create_inventory_item_with_event'].includes(endpoint) || !args || typeof args !== 'object'
      || (endpoint === 'apply_collector_inventory_mutation' && !['quantity', 'condition', 'finish', 'storage'].includes(args.p_mutation_type))
      || typeof args.p_idempotency_key !== 'string' || !args.p_idempotency_key.trim()
      || (endpoint === 'create_inventory_item_with_event' ? args.p_source !== 'csv_import' || args.p_related_entity_type !== 'inventory_append' : args.p_source !== 'collector_workspace')) {
      return NextResponse.json({ error: { message: 'INVALID_COMMAND', code: '22023' } }, { status: 400 });
    }
    const access = await resolveServerAccess(supabase, user);
    if (access.isSuspended) return NextResponse.json({ error: { message: 'AUTHORIZATION_FAILURE', code: '42501' } }, { status: 403 });
    // The shared RPC owns validation, owner/workspace checks, payload fingerprinting
    // and replay-before-current-state validation. Do not recalculate a retry here.
    const { data, error } = await supabase.rpc(endpoint, args);
    if (error) return NextResponse.json({ error: { message: error.message, code: error.code } }, { status: /IDEMPOTENCY_CONFLICT/.test(error.message) ? 409 : 400 });
    return NextResponse.json({ data });
  }
  const mutation = body as CollectorMutation | null;
  if (!mutation || typeof mutation !== "object") {
    return NextResponse.json({ error: "Choose a supported collection update." }, { status: 400 });
  }

  if (['quantity', 'condition', 'finish', 'storage', 'move_quantity', 'remove_quantity'].includes(mutation.type)) {
    return NextResponse.json({ error: 'OPERATION_ID_REQUIRED: use the durable inventory command.' }, { status: 400 });
  }
  const itemResult = await supabase
    .from("inventory_items")
    .select("id,user_id,quantity,data,card_name,set_code,location_id")
    .eq("user_id", user.id)
    .eq("id", mutation.inventoryItemId)
    .maybeSingle();

  if (itemResult.error) return NextResponse.json({ error: itemResult.error.message }, { status: 500 });
  if (!itemResult.data) return NextResponse.json({ error: "Collection record not found." }, { status: 404 });

  const access = await resolveServerAccess(supabase, user);
  if (access.isSuspended) return NextResponse.json({ error: "Collection access is currently suspended." }, { status: 403 });

  const currentCardQuantity = Number(itemResult.data.quantity ?? 0);
  let currentTotalQuantity = currentCardQuantity;
  if (mutation.type === "quantity") {
    const quantityResult = await totalOwnedCardQuantity(supabase, user.id);
    if (!quantityResult.ok) return NextResponse.json({ error: quantityResult.error }, { status: 500 });
    currentTotalQuantity = quantityResult.total;
  }
  const validation = validateCollectorMutation(mutation, {
    membershipTier: access.membershipTier,
    currentTotalQuantity,
    currentCardQuantity,
    hasFullPlatformAccess: access.hasFullPlatformAccess,
    requestedUserId: mutation.userId,
    authenticatedUserId: user.id,
  });
  if (!validation.ok) {
    return NextResponse.json({ error: validation.reason, code: validation.code }, {
      status: validation.code === "unauthorized" ? 403 : 400,
    });
  }

  try {
    await executeMutation(supabase, user.id, mutation);
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
) {
  const now = new Date().toISOString();
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

async function totalOwnedCardQuantity(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
) {
  const pageSize = 1000;
  let from = 0;
  let total = 0;

  for (;;) {
    const { data, error } = await supabase
      .from("inventory_items")
      .select("quantity")
      .eq("user_id", userId)
      .range(from, from + pageSize - 1);

    if (error) return { ok: false as const, error: error.message };
    const rows = data ?? [];
    total += rows.reduce((sum, row) => sum + Number(row.quantity ?? 0), 0);
    if (rows.length < pageSize) return { ok: true as const, total };
    from += pageSize;
  }
}
