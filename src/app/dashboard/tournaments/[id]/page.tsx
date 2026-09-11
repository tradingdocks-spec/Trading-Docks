import { notFound, redirect } from "next/navigation";
import { TournamentDetail } from "@/components/tournaments/TournamentDetail";
import { TournamentSwissOperations } from "@/components/tournaments/TournamentSwissOperations";
import { TournamentStandingsPanel } from "@/components/tournaments/TournamentStandingsPanel";
import { createClient } from "@/lib/supabase/server";
import { standingFromRpc } from "@/lib/tournament-standings";

export const dynamic = "force-dynamic";

export default async function TournamentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/sign-in?next=/dashboard/tournaments/${id}`);
  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  if (!preference?.active_workspace_id) notFound();
  const [{ data: tournament }, { data: registrations }, { count: checkedInCount }, { data: players }, { data: rounds }, { data: matches }] = await Promise.all([
    supabase.from("tournaments").select("id,slug,name,game,format,status,lifecycle_status,pairing_system,planned_rounds,recommended_rounds,round_duration_minutes,top_cut_size,registration_locked_at,started_at,completed_at,current_round_number,starts_at,ends_at,entry_fee,location,description,prize_support,max_players,registration_deadline,decklist_required,public_registration_enabled,waitlist_enabled").eq("id", id).eq("workspace_id", preference.active_workspace_id).maybeSingle(),
    supabase.from("tournament_registrations").select("id,player_name,email,phone,discord_username,status,waitlist_position,registered_at,checked_in_at").eq("tournament_id", id).eq("workspace_id", preference.active_workspace_id).order("registered_at"),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id).eq("workspace_id", preference.active_workspace_id).eq("status", "checked_in"),
    supabase.from("tournament_players").select("id,display_name,player_status,checked_in,seed_order").eq("tournament_id", id).eq("workspace_id", preference.active_workspace_id).order("seed_order"),
    supabase.from("tournament_rounds").select("id,round_number,stage,status,started_at,ends_at,completed_at").eq("tournament_id", id).eq("workspace_id", preference.active_workspace_id).order("round_number"),
    supabase.from("tournament_matches").select("id,round_id,match_number,player_one_id,player_two_id,is_bye,result_status,player_one_games_won,player_two_games_won,game_draws,player_one_match_points,player_two_match_points,version").eq("tournament_id", id).eq("workspace_id", preference.active_workspace_id).order("match_number"),
  ]);
  if (!tournament) notFound();
  const { data: standings } = await supabase.rpc("get_tournament_standings", { target_tournament_id: id });
  return <><TournamentDetail tournament={tournament} registrations={registrations ?? []} checkedInCount={checkedInCount ?? 0} players={players ?? []} rounds={rounds ?? []} matches={matches ?? []} /><TournamentSwissOperations tournamentId={tournament.id} currentRound={tournament.current_round_number} players={players ?? []} rounds={rounds ?? []} matches={matches ?? []} /><TournamentStandingsPanel standings={(standings ?? []).map(standingFromRpc)} currentRound={tournament.current_round_number} /></>;
}
