import { NextResponse } from "next/server";
import { canManageDiscord, resolveDiscordActor } from "@/lib/discord-access";

const PURPOSES = new Set(["general", "deals", "new_arrivals", "tournaments", "events", "buylist", "showcase", "other"]);

export async function PATCH(request: Request) {
  const actor = await resolveDiscordActor();
  if (!actor.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!actor.workspaceId || !canManageDiscord(actor.role)) return NextResponse.json({ error: "Channel management requires workspace owner or admin access." }, { status: 403 });
  const body = await request.json().catch(() => null) as { bindingId?: unknown; enabled?: unknown; purpose?: unknown } | null;
  const bindingId = typeof body?.bindingId === "string" ? body.bindingId : "";
  const purpose = body?.purpose === null || body?.purpose === "" ? null : typeof body?.purpose === "string" && PURPOSES.has(body.purpose) ? body.purpose : undefined;
  if (!bindingId || purpose === undefined || typeof body?.enabled !== "boolean") return NextResponse.json({ error: "Invalid channel update." }, { status: 400 });
  const { data: binding } = await actor.supabase.from("discord_channel_bindings").select("id,can_view,can_send").eq("id", bindingId).eq("workspace_id", actor.workspaceId).maybeSingle();
  if (!binding) return NextResponse.json({ error: "That channel is not part of your workspace integration." }, { status: 404 });
  if (body.enabled && (!binding.can_view || !binding.can_send)) return NextResponse.json({ error: "This channel does not have the permissions required for Trading Docks posts." }, { status: 422 });
  const { data, error } = await actor.supabase.from("discord_channel_bindings").update({ enabled: body.enabled, purpose }).eq("id", bindingId).eq("workspace_id", actor.workspaceId).select("*").single();
  if (error) return NextResponse.json({ error: "Channel settings could not be saved." }, { status: 500 });
  return NextResponse.json({ channel: data });
}
