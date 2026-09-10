import { redirect } from "next/navigation";
import {
  discordErrorSummary,
  discordGuildIconUrl,
  exchangeDiscordCode,
  fetchDiscordGuild,
  hashDiscordOAuthState,
} from "@/lib/discord";
import { canManageDiscord, resolveDiscordActor } from "@/lib/discord-access";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError || !code || !state) redirect("/dashboard/integrations/discord?error=oauth_cancelled");

  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId || !canManageDiscord(actor.role)) {
    redirect("/dashboard/integrations/discord?error=admin_required");
  }

  const { data: stateRow, error: stateLookupError } = await actor.supabase
    .from("discord_oauth_states")
    .select("id,workspace_id,user_id,expires_at,consumed_at")
    .eq("state_hash", hashDiscordOAuthState(state))
    .eq("workspace_id", actor.workspaceId)
    .eq("user_id", actor.user.id)
    .maybeSingle();
  if (stateLookupError || !stateRow || stateRow.consumed_at || new Date(stateRow.expires_at).getTime() <= Date.now()) {
    redirect("/dashboard/integrations/discord?error=oauth_state_invalid");
  }

  const { error: consumeError } = await actor.supabase
    .from("discord_oauth_states")
    .update({ consumed_at: new Date().toISOString() })
    .eq("id", stateRow.id)
    .is("consumed_at", null);
  if (consumeError) redirect("/dashboard/integrations/discord?error=oauth_state_invalid");

  try {
    const exchange = await exchangeDiscordCode(code);
    let guild: { id: string; name: string; icon: string | null } = exchange.guild;
    try {
      const refreshedGuild = await fetchDiscordGuild(guild.id);
      guild = { id: refreshedGuild.id, name: refreshedGuild.name, icon: refreshedGuild.icon ?? null };
    } catch {
      // The install response still contains a safe guild identity if the bot API is briefly unavailable.
    }
    const { error } = await actor.supabase.from("discord_integrations").upsert({
      workspace_id: actor.workspaceId,
      guild_id: guild.id,
      guild_name: guild.name,
      guild_icon_url: discordGuildIconUrl(guild.id, guild.icon),
      installed_by_user_id: actor.user.id,
      connected_at: new Date().toISOString(),
      disconnected_at: null,
      status: "connected",
      metadata: { installation: "discord_oauth2" },
    }, { onConflict: "workspace_id,guild_id" });
    if (error) {
      console.error("Discord integration persistence failed", { code: error.code, message: error.message });
      redirect("/dashboard/integrations/discord?error=integration_save_failed");
    }
    redirect("/dashboard/integrations/discord?connected=1");
  } catch (error) {
    const summary = discordErrorSummary(error);
    console.error("Discord OAuth callback failed", summary);
    redirect("/dashboard/integrations/discord?error=oauth_exchange_failed");
  }
}
