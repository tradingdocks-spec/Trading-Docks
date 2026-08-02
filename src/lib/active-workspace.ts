import { createClient } from "@/lib/supabase/client";

export async function getActiveWorkspaceContext() {
  const supabase = createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error("Sign in again to access your workspace.");
  const { data, error: preferenceError } = await supabase.from("user_preferences")
    .select("active_workspace_id").eq("user_id", user.id).single();
  if (preferenceError || !data?.active_workspace_id) throw new Error("No active workspace is available for this account.");
  return { supabase, userId: user.id, workspaceId: data.active_workspace_id as string };
}
