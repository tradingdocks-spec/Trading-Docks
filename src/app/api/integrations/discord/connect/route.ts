import { redirect } from "next/navigation";
import {
  createDiscordOAuthState,
  discordAuthorizeUrl,
  discordIsConfigured,
} from "@/lib/discord";
import { canManageDiscord, resolveDiscordActor } from "@/lib/discord-access";

export async function GET(request: Request) {
  const actor = await resolveDiscordActor();
  if (!actor.user) redirect("/sign-in?next=/dashboard/integrations/discord");
  if (!actor.workspaceId || !canManageDiscord(actor.role)) {
    return Response.redirect(new URL("/dashboard/integrations/discord?error=admin_required", request.url));
  }
  if (!discordIsConfigured()) {
    return Response.redirect(new URL("/dashboard/integrations/discord?error=configuration_required", request.url));
  }

  const state = createDiscordOAuthState();
  const { error } = await actor.supabase.from("discord_oauth_states").insert({
    workspace_id: actor.workspaceId,
    user_id: actor.user.id,
    state_hash: state.hash,
    expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  });
  if (error) {
    console.error("Discord OAuth state creation failed", { code: error.code, message: error.message });
    return Response.redirect(new URL("/dashboard/integrations/discord?error=state_unavailable", request.url));
  }
  redirect(discordAuthorizeUrl(state.raw));
}
