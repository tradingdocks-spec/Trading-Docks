import { DiscordIntegrationPage } from "@/components/dashboard/integrations/DiscordIntegrationPage";
import { resolveDiscordActor, canManageDiscord, canSendDiscord } from "@/lib/discord-access";

export const dynamic = "force-dynamic";

export default async function DiscordIntegrationRoute({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const type = typeof params.type === "string" && ["general", "tournament", "deal", "new_arrival", "restock", "showcase", "buylist", "test"].includes(params.type) ? params.type as "general" | "tournament" | "deal" | "new_arrival" | "restock" | "showcase" | "buylist" | "test" : undefined;
  const prefill = { type, title: typeof params.title === "string" ? params.title : undefined, body: typeof params.body === "string" ? params.body : undefined, link: typeof params.link === "string" ? params.link : undefined, tournamentId: typeof params.tournamentId === "string" ? params.tournamentId : undefined };
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) {
    return <DiscordIntegrationPage integration={null} channels={[]} logs={[]} showcase={null} canManage={false} canSend={false} queryError={typeof params.error === "string" ? params.error : null} prefill={prefill} />;
  }
  const [{ data: integrations }, { data: channels }, { data: logs }, { data: showcase }] = await Promise.all([
    actor.supabase.from("discord_integrations").select("id,guild_id,guild_name,guild_icon_url,status,connected_at,disconnected_at").eq("workspace_id", actor.workspaceId).order("updated_at", { ascending: false }).limit(1),
    actor.supabase.from("discord_channel_bindings").select("id,channel_id,channel_name,purpose,enabled,can_view,can_send,can_embed,unavailable_reason").eq("workspace_id", actor.workspaceId).order("channel_name", { ascending: true }),
    actor.supabase.from("discord_message_log").select("id,channel_name,announcement_type,title,status,sent_at,error_summary").eq("workspace_id", actor.workspaceId).order("sent_at", { ascending: false }).limit(20),
    actor.supabase.from("showcase_profiles").select("slug,display_name,enabled").eq("workspace_id", actor.workspaceId).maybeSingle(),
  ]);
  const integration = integrations?.[0] ?? null;
  return (
    <DiscordIntegrationPage
      integration={integration}
      channels={channels ?? []}
      logs={logs ?? []}
      showcase={showcase ?? null}
      canManage={canManageDiscord(actor.role)}
      canSend={canSendDiscord(actor.role)}
      queryError={typeof params.error === "string" ? params.error : null}
      connected={params.connected === "1"}
      prefill={prefill}
    />
  );
}
