import { createClient } from "@/lib/supabase/server";

export type DiscordRole = "owner" | "admin" | "manager" | "employee" | "member" | "viewer";

export async function resolveDiscordActor() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return { supabase, user: null, workspaceId: null, role: null as DiscordRole | null };
  const { data: preference, error: preferenceError } = await supabase
    .from("user_preferences")
    .select("active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const workspaceId = preferenceError ? null : preference?.active_workspace_id ?? null;
  if (!workspaceId) return { supabase, user, workspaceId: null, role: null as DiscordRole | null };
  const { data: membership } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();
  const role = typeof membership?.role === "string" ? membership.role as DiscordRole : null;
  return { supabase, user, workspaceId, role };
}

export function canManageDiscord(role: DiscordRole | null) {
  return role === "owner" || role === "admin";
}

export function canSendDiscord(role: DiscordRole | null) {
  return canManageDiscord(role) || role === "manager" || role === "employee";
}

export function discordRedirect(request: Request, query: string) {
  const url = new URL("/dashboard/integrations/discord", request.url);
  url.search = query;
  return url;
}
