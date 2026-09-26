import { NextResponse } from "next/server";
import { discordErrorSummary, sendDiscordMessage, type DiscordAnnouncementType, DISCORD_ANNOUNCEMENT_TYPES } from "@/lib/discord";
import { canSendDiscord, resolveDiscordActor } from "@/lib/discord-access";

type FeaturedCard = { name: string; set?: string | null; condition?: string | null; price?: number | null };
type MessageBody = {
  bindingId?: unknown;
  type?: unknown;
  title?: unknown;
  body?: unknown;
  link?: unknown;
  featuredCards?: unknown;
  tournamentId?: unknown;
};

function safeText(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function announcementType(value: unknown): DiscordAnnouncementType | null {
  return typeof value === "string" && DISCORD_ANNOUNCEMENT_TYPES.includes(value as DiscordAnnouncementType)
    ? value as DiscordAnnouncementType
    : null;
}

function cardLines(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const card = entry as FeaturedCard;
    if (!safeText(card.name, 140)) return [];
    const details = [safeText(card.set, 80), safeText(card.condition, 40)].filter(Boolean).join(" · ");
    const price = typeof card.price === "number" && Number.isFinite(card.price) && card.price > 0 ? ` — $${card.price.toFixed(2)}` : "";
    return [`• ${safeText(card.name, 140)}${details ? ` (${details})` : ""}${price}`];
  });
}

export async function POST(request: Request) {
  const actor = await resolveDiscordActor();
  if (!actor.user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!actor.workspaceId || !canSendDiscord(actor.role)) return NextResponse.json({ error: "You do not have permission to send Discord posts." }, { status: 403 });
  const body = await request.json().catch(() => null) as MessageBody | null;
  const bindingId = typeof body?.bindingId === "string" ? body.bindingId : "";
  const type = announcementType(body?.type);
  const title = safeText(body?.title, 160);
  const message = safeText(body?.body, 4000);
  const link = safeText(body?.link, 500);
  if (!bindingId || !type || !title || !message) return NextResponse.json({ error: "Choose a channel and provide a title and message." }, { status: 400 });

  const [{ data: binding }, { data: integration }, { data: profile }] = await Promise.all([
    actor.supabase.from("discord_channel_bindings").select("id,channel_id,channel_name,enabled,can_send,can_embed,discord_integration_id").eq("id", bindingId).eq("workspace_id", actor.workspaceId).maybeSingle(),
    actor.supabase.from("discord_integrations").select("id,guild_name,status").eq("workspace_id", actor.workspaceId).eq("status", "connected").order("updated_at", { ascending: false }).limit(1).maybeSingle(),
    actor.supabase.from("storefront_profiles").select("slug,display_name,enabled").eq("workspace_id", actor.workspaceId).maybeSingle(),
  ]);
  if (!binding || !integration || binding.discord_integration_id !== integration.id) return NextResponse.json({ error: "The selected Discord channel is not authorized for this workspace." }, { status: 409 });
  if (!binding.enabled || !binding.can_send) return NextResponse.json({ error: "Enable this channel after granting the bot permission to post." }, { status: 422 });
  const tournamentId = typeof body?.tournamentId === "string" ? body.tournamentId : null;
  if (tournamentId) {
    const { data: tournament } = await actor.supabase.from("tournaments").select("id").eq("id", tournamentId).eq("workspace_id", actor.workspaceId).maybeSingle();
    if (!tournament) return NextResponse.json({ error: "The selected tournament is not available in this workspace." }, { status: 409 });
  }

  const showcaseUrl = profile?.enabled && profile.slug
    ? `${(process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin).replace(/\/$/, "")}/s/${encodeURIComponent(profile.slug)}?utm_source=discord&utm_medium=community`
    : "";
  const featured = cardLines(body?.featuredCards);
  const content = [message, featured.length ? `\nFeatured cards:\n${featured.join("\n")}` : "", link ? `\n${link}` : "", showcaseUrl && (type === "showcase" || type === "new_arrival" || type === "restock") ? `\nBrowse our live inventory: ${showcaseUrl}` : "", "\nTrading Docks"].filter(Boolean).join("\n");
  const embeds = binding.can_embed ? [{ title, description: content.slice(0, 4096), color: 0x35cafa, footer: { text: "Trading Docks" }, timestamp: new Date().toISOString() }] : undefined;
  const preview = content.slice(0, 1000);
  try {
    const sent = await sendDiscordMessage(binding.channel_id, { content: embeds ? "" : content.slice(0, 2000), embeds });
    const { error: logError } = await actor.supabase.from("discord_message_log").insert({
      workspace_id: actor.workspaceId,
      discord_integration_id: integration.id,
      channel_id: binding.channel_id,
      channel_name: binding.channel_name,
      announcement_type: type,
      title,
      message_preview: preview,
      discord_message_id: sent.id,
      tournament_id: tournamentId,
      status: "sent",
      sent_by: actor.user.id,
    });
    if (logError) console.error("Discord success log failed", { code: logError.code, message: logError.message });
    return NextResponse.json({ ok: true, messageId: sent.id });
  } catch (error) {
    const summary = discordErrorSummary(error);
    console.error("Discord message send failed", { workspaceId: actor.workspaceId, channelId: binding.channel_id, ...summary });
    await actor.supabase.from("discord_message_log").insert({
      workspace_id: actor.workspaceId,
      discord_integration_id: integration.id,
      channel_id: binding.channel_id,
      channel_name: binding.channel_name,
      announcement_type: type,
      title,
      message_preview: preview,
      status: "failed",
      tournament_id: tournamentId,
      sent_by: actor.user.id,
      error_code: summary.code ?? `http_${summary.status}`,
      error_summary: summary.message.slice(0, 240),
    });
    const message = summary.status === 401
      ? "The Discord connection is no longer valid. Reconnect Discord and try again."
      : summary.status === 403
        ? "The bot cannot send messages to this channel. Check the bot's channel permissions."
        : summary.status === 404
          ? "Discord could not find this channel. Refresh channels and try again."
          : summary.status === 429
            ? "Discord is rate limiting posts. Wait a moment and try again."
            : "Unable to send announcement.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
