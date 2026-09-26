import { createClient } from "@/lib/supabase/server";

export async function getShowcaseTagAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in required.", status: 401 as const };

  const { data: preference } = await supabase.from("user_preferences")
    .select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preference?.active_workspace_id;
  if (!workspaceId) return { error: "Unable to resolve your active workspace.", status: 403 as const };

  const [{ data: membership }, { data: workspace }] = await Promise.all([
    supabase.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle(),
    supabase.from("workspaces").select("owner_id").eq("id", workspaceId).maybeSingle(),
  ]);
  if (!membership || !["owner", "admin"].includes(String(membership.role))) {
    return { error: "Store tags require workspace owner or admin access.", status: 403 as const };
  }
  if (!workspace?.owner_id) return { error: "Unable to resolve the workspace inventory owner.", status: 403 as const };
  return { supabase, user, workspaceId, ownerId: workspace.owner_id } as const;
}
