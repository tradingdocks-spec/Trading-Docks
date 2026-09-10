import { NextResponse } from "next/server";
import { canManageDiscord, resolveDiscordActor } from "@/lib/discord-access";

export async function POST() {
  const actor = await resolveDiscordActor();
  if (!actor.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!actor.workspaceId || !canManageDiscord(actor.role)) return NextResponse.json({ error: "Disconnecting Discord requires workspace owner or admin access." }, { status: 403 });
  const { data: integration } = await actor.supabase.from("discord_integrations").select("id").eq("workspace_id", actor.workspaceId).eq("status", "connected").order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (!integration) return NextResponse.json({ error: "No connected Discord server found." }, { status: 404 });
  const { error } = await actor.supabase.from("discord_integrations").update({ status: "disconnected", disconnected_at: new Date().toISOString() }).eq("id", integration.id).eq("workspace_id", actor.workspaceId);
  if (error) return NextResponse.json({ error: "Discord could not be disconnected." }, { status: 500 });
  await actor.supabase.from("discord_channel_bindings").update({ enabled: false }).eq("discord_integration_id", integration.id).eq("workspace_id", actor.workspaceId);
  return NextResponse.json({ ok: true });
}
