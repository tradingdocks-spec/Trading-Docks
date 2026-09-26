import { ShowcaseDashboard } from "@/components/dashboard/showcase/ShowcaseDashboard";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ShowcasePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preference?.active_workspace_id;
  const { data: profile } = workspaceId ? await supabase.from("storefront_profiles").select("*").eq("workspace_id", workspaceId).maybeSingle() : { data: null };
  const { count } = workspaceId ? await supabase.from("inventory_items").select("id", { count: "exact", head: true }).eq("user_id", user.id).gt("quantity", 0) : { count: 0 };
  const { count: listedCount } = workspaceId ? await supabase.from("storefront_listings").select("id", { count: "exact", head: true }).eq("workspace_id", workspaceId).eq("enabled", true) : { count: 0 };
  return <ShowcaseDashboard profile={profile} inventoryCount={count ?? 0} listedCount={listedCount ?? 0} />;
}
