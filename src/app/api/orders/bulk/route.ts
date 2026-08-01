import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

const allowedStatuses = new Set(["new", "processing", "shipped", "delivered", "cancelled", "refunded"]);

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { ids?: string[]; status?: string } | null;
  const ids = [...new Set((body?.ids ?? []).filter((id) => typeof id === "string"))].slice(0, 250);
  const status = String(body?.status ?? "").toLowerCase();
  if (!ids.length || !allowedStatuses.has(status)) {
    return NextResponse.json({ error: "Choose at least one order and a valid status." }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("marketplace_orders")
    .update({ normalized_status: status, updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .in("id", ids)
    .select("id");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ updated: data?.length ?? 0 });
}
