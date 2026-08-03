import { NextResponse } from "next/server";
import { getEffectivePlan } from "@/lib/effective-plan";
import { hasPlanAccess } from "@/lib/tier-access";

import { createClient } from "@/lib/supabase/server";

type Action = "match" | "start_pulling" | "mark_picked" | "pack" | "ship" | "complete";

async function requireFeatureAccess() {
  if (!hasPlanAccess(await getEffectivePlan(), "orders")) {
    return NextResponse.json(
      { error: "Orders requires a higher Trading Docks plan." },
      { status: 403 },
    );
  }
  return null;
}

export async function PATCH(request: Request) {
  const accessDenied = await requireFeatureAccess();
  if (accessDenied) return accessDenied;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as { orderId?: string; action?: Action; itemId?: string; trackingNumber?: string; carrier?: string } | null;
  const orderId = String(body?.orderId ?? "");
  const action = body?.action;
  if (!orderId || !action) return NextResponse.json({ error: "Order and action are required." }, { status: 400 });

  const { data: order } = await supabase.from("marketplace_orders").select("id,fulfillment_stage").eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  if (action === "match") {
    const { data: lines } = await supabase.from("marketplace_order_items").select("id,title,quantity,external_sku,inventory_item_id").eq("marketplace_order_id", orderId).eq("user_id", user.id);
    const { data: inventory } = await supabase.from("inventory_items").select("id,card_name,sku,quantity,location_id").eq("user_id", user.id).gt("quantity", 0);
    let matched = 0; let shortages = 0;
    for (const line of lines ?? []) {
      const sku = String(line.external_sku ?? "").trim().toLowerCase();
      const title = String(line.title ?? "").trim().toLowerCase();
      const candidates = (inventory ?? []).filter((item) => (sku && String(item.sku ?? "").toLowerCase() === sku) || String(item.card_name ?? "").toLowerCase() === title);
      const available = candidates.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0);
      const item = candidates[0]; const needed = Number(line.quantity ?? 1);
      const ok = Boolean(item) && available >= needed;
      await supabase.from("marketplace_order_items").update({ inventory_item_id: item?.id ?? null, match_status: ok ? "matched" : item ? "conflict" : "unmatched", inventory_reserved_quantity: ok ? needed : 0, updated_at: new Date().toISOString() }).eq("id", line.id).eq("user_id", user.id);
      if (ok) matched += 1; else shortages += 1;
    }
    const stage = shortages ? "needs_review" : "ready_to_pull";
    await supabase.from("marketplace_orders").update({ fulfillment_stage: stage, inventory_reserved_at: shortages ? null : new Date().toISOString(), normalized_status: shortages ? "new" : "processing", updated_at: new Date().toISOString() }).eq("id", orderId).eq("user_id", user.id);
    return NextResponse.json({ stage, matched, shortages });
  }

  if (action === "mark_picked") {
    const itemId = String(body?.itemId ?? "");
    const { data: line } = await supabase.from("marketplace_order_items").select("id,quantity,picked_quantity").eq("id", itemId).eq("marketplace_order_id", orderId).eq("user_id", user.id).maybeSingle();
    if (!line) return NextResponse.json({ error: "Order item not found." }, { status: 404 });
    const picked = Number(line.picked_quantity ?? 0) >= Number(line.quantity) ? 0 : Number(line.quantity);
    await supabase.from("marketplace_order_items").update({ picked_quantity: picked, updated_at: new Date().toISOString() }).eq("id", itemId).eq("user_id", user.id);
    return NextResponse.json({ picked });
  }

  const stageMap = { start_pulling: "pulling", pack: "packed", ship: "shipped", complete: "completed" } as const;
  if (action === "ship") {
    const { data: lines } = await supabase.from("marketplace_order_items").select("id,title,quantity,inventory_item_id,inventory_deducted_at").eq("marketplace_order_id", orderId).eq("user_id", user.id);
    if ((lines ?? []).some((line) => !line.inventory_item_id)) return NextResponse.json({ error: "Match every line to inventory before shipping." }, { status: 409 });
    for (const line of lines ?? []) {
      if (line.inventory_deducted_at) continue;
      const { data: item } = await supabase.from("inventory_items").select("id,quantity,card_name").eq("id", line.inventory_item_id).eq("user_id", user.id).maybeSingle();
      if (!item || Number(item.quantity) < Number(line.quantity)) return NextResponse.json({ error: `Not enough inventory for ${line.title}.` }, { status: 409 });
      const now = new Date().toISOString();
      await supabase.from("inventory_items").update({ quantity: Number(item.quantity) - Number(line.quantity), updated_at: now }).eq("id", item.id).eq("user_id", user.id);
      await supabase.from("marketplace_order_items").update({ inventory_deducted_at: now }).eq("id", line.id).eq("user_id", user.id);
      await supabase.from("inventory_movements").insert({ id: crypto.randomUUID(), user_id: user.id, item_name: item.card_name, occurred_at: now, data: { action: "order_fulfilled", order_id: orderId, quantity: -Number(line.quantity) } });
    }
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { fulfillment_stage: stageMap[action as keyof typeof stageMap], updated_at: now };
  if (action === "start_pulling") update.pull_started_at = now;
  if (action === "pack") update.packed_at = now;
  if (action === "ship") Object.assign(update, { normalized_status: "shipped", shipped_at: now, tracking_number: String(body?.trackingNumber ?? "").trim() || null, shipping_carrier: String(body?.carrier ?? "").trim() || null });
  if (action === "complete") Object.assign(update, { normalized_status: "delivered", delivered_at: now });
  const { error } = await supabase.from("marketplace_orders").update(update).eq("id", orderId).eq("user_id", user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ stage: update.fulfillment_stage });
}
