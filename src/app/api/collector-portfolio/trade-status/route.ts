import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATUSES = new Set(["available", "reserved", "pending", "not_for_trade", "looking_for_upgrade", "for_sale"]);

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { inventoryItemId?: string; status?: string; tradeValue?: number; notes?: string } | null;
  if (!body?.inventoryItemId || !body.status || !STATUSES.has(body.status)) return NextResponse.json({ error: "Choose a valid card and status." }, { status: 400 });
  const tradeValue = Number(body.tradeValue ?? 0);
  if (!Number.isFinite(tradeValue) || tradeValue < 0) return NextResponse.json({ error: "Trade value must be zero or greater." }, { status: 400 });
  const { data, error } = await supabase.from("binder_card_trade_status").upsert({ user_id: user.id, inventory_item_id: body.inventoryItemId, status: body.status, trade_value: tradeValue, notes: String(body.notes ?? "").slice(0, 500), updated_at: new Date().toISOString() }, { onConflict: "user_id,inventory_item_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
