import { NextResponse } from "next/server";
import { fetchWritableDiscordChannels } from "@/lib/discord";
import { canManageDiscord, resolveDiscordActor } from "@/lib/discord-access";

export async function POST() {
  const actor = await resolveDiscordActor();
  if (!actor.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!actor.workspaceId || !canManageDiscord(actor.role)) return NextResponse.json({ error: "Discord administration requires workspace owner or admin access." }, { status: 403 });
  const { data: integration, error: integrationError } = await actor.supabase
    .from("discord_integrations")
    .select("id,guild_id,status")
    .eq("workspace_id", actor.workspaceId)
    .eq("status", "connected")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (integrationError || !integration) return NextResponse.json({ error: "Connect a Discord server first." }, { status: 409 });
  try {
    const channels = await fetchWritableDiscordChannels(integration.guild_id);
    const now = new Date().toISOString();
    const rows = channels.map((channel) => ({
      workspace_id: actor.workspaceId,
      discord_integration_id: integration.id,
      channel_id: channel.id,
      channel_name: channel.name,
      can_view: channel.canView,
      can_send: channel.canSend,
      can_embed: channel.canEmbed,
      unavailable_reason: channel.unavailableReason,
      last_seen_at: now,
    }));
    if (rows.length) {
      const { error } = await actor.supabase.from("discord_channel_bindings").upsert(rows, { onConflict: "discord_integration_id,channel_id" });
      if (error) throw error;
    }
    await actor.supabase.from("discord_channel_bindings").update({ last_seen_at: null, enabled: false }).eq("discord_integration_id", integration.id).lt("last_seen_at", now);
    const { data: bindings, error: bindingError } = await actor.supabase
      .from("discord_channel_bindings")
      .select("id,channel_id,channel_name,purpose,enabled,can_view,can_send,can_embed,unavailable_reason")
      .eq("workspace_id", actor.workspaceId)
      .eq("discord_integration_id", integration.id)
      .order("channel_name", { ascending: true });
    if (bindingError) throw bindingError;
    return NextResponse.json({ channels: bindings ?? [] });
  } catch (error) {
    console.error("Discord channel discovery failed", { workspaceId: actor.workspaceId, integrationId: integration.id, error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: "Discord channels could not be refreshed. Check that the bot is still installed." }, { status: 502 });
  }
}
