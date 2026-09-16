import { NextResponse } from "next/server";
import { canSendDiscord, resolveDiscordActor } from "@/lib/discord-access";

export async function GET() {
  const actor = await resolveDiscordActor();
  if (!actor.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!actor.workspaceId || !canSendDiscord(actor.role)) return NextResponse.json({ error: "Discord sending access is required." }, { status: 403 });
  const { data: workspace } = await actor.supabase.from("workspaces").select("owner_id").eq("id", actor.workspaceId).maybeSingle();
  if (!workspace?.owner_id) return NextResponse.json({ cards: [] });
  const { data, error } = await actor.supabase
    .from("inventory_items")
    .select("id,card_name,set_code,collector_number,quantity,inventory_value,data,created_at")
    .eq("user_id", workspace.owner_id)
    .gt("quantity", 0)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) return NextResponse.json({ error: "Recent inventory could not be loaded." }, { status: 503 });
  const cards = (data ?? []).map((item) => {
    const record = item.data && typeof item.data === "object" && !Array.isArray(item.data) ? item.data as Record<string, unknown> : {};
    return {
      id: item.id,
      name: item.card_name,
      set: typeof record.setName === "string" ? record.setName : item.set_code,
      condition: typeof record.condition === "string" ? record.condition : null,
      price: Number(record.marketPrice ?? item.inventory_value ?? 0) || 0,
      quantity: item.quantity,
    };
  });
  return NextResponse.json({ cards });
}
