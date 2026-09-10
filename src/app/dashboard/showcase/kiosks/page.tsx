import { createClient } from "@/lib/supabase/server";
import { KioskManagement } from "@/components/dashboard/showcase/KioskManagement";

export const dynamic = "force-dynamic";

export default async function ShowcaseKiosksPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: preference } = await supabase
    .from("user_preferences")
    .select("active_workspace_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const workspaceId = preference?.active_workspace_id;
  const { data: kiosks } = workspaceId
    ? await supabase
        .from("showcase_kiosk_devices")
        .select("id,display_name,enabled,last_seen_at,revoked_at,paired_at")
        .eq("workspace_id", workspaceId)
        .order("paired_at", { ascending: false })
    : { data: [] };

  return <KioskManagement initialKiosks={kiosks ?? []} />;
}