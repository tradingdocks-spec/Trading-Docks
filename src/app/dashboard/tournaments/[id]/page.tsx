import { notFound, redirect } from "next/navigation";
import { TournamentDetail } from "@/components/tournaments/TournamentDetail";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/dashboard/tournaments/${id}`);
  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  if (!preference?.active_workspace_id) notFound();
  const [{ data: tournament }, { data: registrations }] = await Promise.all([
    supabase.from("tournaments").select("id,slug,name,game,format,status,starts_at,ends_at,entry_fee,location,description,prize_support,max_players,registration_deadline,decklist_required,public_registration_enabled,waitlist_enabled").eq("id", id).eq("workspace_id", preference.active_workspace_id).maybeSingle(),
    supabase.from("tournament_registrations").select("id,player_name,email,phone,discord_username,status,waitlist_position,registered_at,checked_in_at").eq("tournament_id", id).eq("workspace_id", preference.active_workspace_id).order("registered_at"),
  ]);
  if (!tournament) notFound();
  return <TournamentDetail tournament={tournament} registrations={registrations ?? []} />;
}
