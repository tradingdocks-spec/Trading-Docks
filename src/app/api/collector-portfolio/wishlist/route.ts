import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const cardName = String(body?.cardName ?? "").trim().slice(0, 160);
  if (!cardName) return NextResponse.json({ error: "Enter a card name." }, { status: 400 });
  const value = body?.targetValue == null ? null : Number(body.targetValue);
  if (value != null && (!Number.isFinite(value) || value < 0)) return NextResponse.json({ error: "Target value must be zero or greater." }, { status: 400 });
  const priority = ["low", "medium", "high", "grail"].includes(String(body?.priority)) ? String(body?.priority) : "medium";
  const { data, error } = await supabase.from("collector_wishlist").insert({ user_id: user.id, card_name: cardName, set_code: String(body?.setCode ?? "").trim().toUpperCase().slice(0, 12) || null, target_condition: String(body?.targetCondition ?? "Any").slice(0, 40), target_finish: String(body?.targetFinish ?? "").slice(0, 40) || null, target_value: value, priority, notes: String(body?.notes ?? "").slice(0, 500) }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data }, { status: 201 });
}
