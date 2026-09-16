import { createClient } from "@/lib/supabase/server";
import { KioskManagement } from "@/components/dashboard/showcase/KioskManagement";
import Link from "next/link";

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
  const { data: profile } = workspaceId ? await supabase.from("showcase_profiles").select("id").eq("workspace_id", workspaceId).maybeSingle() : { data: null };
  if (!profile) return <main className="dashboard-responsive mx-auto max-w-2xl px-4 py-10 sm:px-7"><section className="rounded-[26px] border border-td-accent/[.15] bg-td-accent/[.05] p-7 sm:p-10"><p className="text-xs font-bold uppercase tracking-[.18em] text-td-accent-text">Showcase · Devices</p><h1 className="mt-3 text-3xl font-semibold text-td-primary">Create your Showcase profile first</h1><p className="mt-3 text-sm leading-6 text-td-muted">Kiosk pairing is scoped to your public Showcase. Create the profile, then return here to pair a counter device.</p><Link href="/dashboard/showcase/settings" className="mt-6 inline-flex h-11 items-center rounded-xl bg-td-accent px-4 text-sm font-bold text-td-on-accent">Create Showcase Profile</Link></section></main>;
  const { data: kiosks } = workspaceId
    ? await supabase
        .from("showcase_kiosk_devices")
        .select("id,display_name,enabled,last_seen_at,revoked_at,paired_at")
        .eq("workspace_id", workspaceId)
        .order("paired_at", { ascending: false })
    : { data: [] };

  return <KioskManagement initialKiosks={kiosks ?? []} />;
}
