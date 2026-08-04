import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const STATUSES = new Set(["new", "reviewing", "accepted", "declined", "completed"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { status?: string } | null;
  if (!body?.status || !STATUSES.has(body.status)) return NextResponse.json({ error: "Choose a valid offer status." }, { status: 400 });
  const { id } = await context.params;
  const { data, error } = await supabase.from("trade_requests").update({ status: body.status, updated_at: new Date().toISOString() }).eq("id", id).eq("portfolio_owner_id", user.id).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ item: data });
}
