import { ShowcaseSettings } from "@/components/dashboard/showcase/ShowcaseSettings";
import { createClient } from "@/lib/supabase/server";

export default async function ShowcaseSettingsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: preference } = user ? await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle() : { data: null };
  const { data: profile } = preference?.active_workspace_id ? await supabase.from("storefront_profiles").select("*").eq("workspace_id", preference.active_workspace_id).maybeSingle() : { data: null };
  return <ShowcaseSettings profile={profile} />;
}
