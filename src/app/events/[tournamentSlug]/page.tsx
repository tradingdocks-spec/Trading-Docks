import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicTournamentRegistration } from "@/components/tournaments/PublicTournamentRegistration";

export const dynamic = "force-dynamic";

export default async function PublicTournamentPage({ params, searchParams }: { params: Promise<{ tournamentSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tournamentSlug } = await params;
  const query = await searchParams;
  const registrationSource = query.utm_source === "discord" ? "discord" : query.utm_source === "qr" ? "qr" : "direct";
  const supabase = createAdminClient();
  const { data: tournament } = await supabase.from("tournaments").select("id,slug,name,game,format,starts_at,ends_at,entry_fee,location,description,prize_support,max_players,registration_deadline,decklist_required,waitlist_enabled,workspace_id").eq("slug", decodeURIComponent(tournamentSlug)).eq("status", "published").eq("public_registration_enabled", true).maybeSingle();
  if (!tournament) notFound();
  const [{ data: workspace }, { count: registeredCount }, { count: waitlistCount }] = await Promise.all([
    supabase.from("workspaces").select("name").eq("id", tournament.workspace_id).maybeSingle(),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id).in("status", ["registered", "checked_in"]),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id).eq("status", "waitlisted"),
  ]);
  return <PublicTournamentRegistration tournament={tournament} storeName={workspace?.name ?? "Trading Docks store"} registeredCount={registeredCount ?? 0} waitlistCount={waitlistCount ?? 0} registrationSource={registrationSource} />;
}
