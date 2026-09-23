import type { SupabaseClient } from "@supabase/supabase-js";

type AcceptanceConfig = { userId?: string; workspaceId?: string };

// Server callers only: user must come from auth.getUser(), never browser claims.
// The allowlist is server configuration, not user-editable profile metadata.
export async function scannerBridgeOwnerAccess(
  supabase: SupabaseClient,
  user: { id: string; is_anonymous?: boolean } | null,
  config: AcceptanceConfig = {
    userId: process.env.SCANNER_BRIDGE_ACCEPTANCE_USER_ID,
    workspaceId: process.env.SCANNER_BRIDGE_ACCEPTANCE_WORKSPACE_ID,
  },
): Promise<boolean> {
  if (!user || user.is_anonymous || !config.userId || !config.workspaceId || user.id !== config.userId) return false;
  try {
    const [preference, workspace, member] = await Promise.all([
      supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle(),
      supabase.from("workspaces").select("owner_id").eq("id", config.workspaceId).maybeSingle(),
      supabase.from("workspace_members").select("role").eq("workspace_id", config.workspaceId).eq("user_id", user.id).maybeSingle(),
    ]);
    return !preference.error && !workspace.error && !member.error
      && preference.data?.active_workspace_id === config.workspaceId
      && workspace.data?.owner_id === user.id && member.data?.role === "owner";
  } catch {
    // An unavailable gate must never break Upload/CSV or open access.
    return false;
  }
}
