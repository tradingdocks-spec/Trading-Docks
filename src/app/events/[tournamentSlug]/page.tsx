import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { PublicTournamentRegistration } from "@/components/tournaments/PublicTournamentRegistration";
import { PublicTournamentStatus } from "@/components/tournaments/PublicTournamentStatus";
import { standingFromRpc } from "@/lib/tournament-standings";

export const dynamic = "force-dynamic";

export default async function PublicTournamentPage({ params, searchParams }: { params: Promise<{ tournamentSlug: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { tournamentSlug } = await params;
  const query = await searchParams;
  const registrationSource = query.utm_source === "discord" ? "discord" : query.utm_source === "qr" ? "qr" : "direct";
  const supabase = createAdminClient();
  const { data: tournament } = await supabase.from("tournaments").select("id,slug,name,game,format,starts_at,ends_at,entry_fee,location,description,prize_support,max_players,registration_deadline,decklist_required,waitlist_enabled,registration_locked_at,public_registration_enabled,lifecycle_status,current_round_number,workspace_id").eq("slug", decodeURIComponent(tournamentSlug)).eq("status", "published").eq("public_registration_enabled", true).maybeSingle();
  if (!tournament) notFound();
  const [{ data: workspace }, { count: registeredCount }, { count: waitlistCount }, { data: standings }] = await Promise.all([
    supabase.from("workspaces").select("name").eq("id", tournament.workspace_id).maybeSingle(),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id).in("status", ["registered", "checked_in"]),
    supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("tournament_id", tournament.id).eq("status", "waitlisted"),
    supabase.rpc("get_tournament_standings", { target_tournament_id: tournament.id }),
  ]);
  const currentRound = tournament.current_round_number ?? 0;
  const { data: round } = currentRound > 0 ? await supabase.from("tournament_rounds").select("id,round_number").eq("tournament_id", tournament.id).eq("round_number", currentRound).maybeSingle() : { data: null };
  const { data: matches } = round ? await supabase.from("tournament_matches").select("match_number,player_one_id,player_two_id,is_bye,result_status").eq("round_id", round.id).order("match_number") : { data: [] };
  const playerIds = [...new Set((matches ?? []).flatMap((match) => [match.player_one_id, match.player_two_id].filter((id): id is string => Boolean(id))))];
  const { data: players } = playerIds.length ? await supabase.from("tournament_players").select("id,display_name").in("id", playerIds) : { data: [] };
  const names = new Map((players ?? []).map((player) => [player.id, player.display_name]));
  const pairings = (matches ?? []).map((match) => ({ round: currentRound, table: match.match_number, player: names.get(match.player_one_id) ?? "Player", opponent: match.is_bye ? "BYE" : names.get(match.player_two_id ?? "") ?? "Player", resultStatus: match.result_status }));
  const safeStandings = (standings ?? []).map(standingFromRpc);
  return <><PublicTournamentRegistration tournament={tournament} storeName={workspace?.name ?? "Trading Docks store"} registeredCount={registeredCount ?? 0} waitlistCount={waitlistCount ?? 0} registrationSource={registrationSource} /><PublicTournamentStatus standings={safeStandings} pairings={pairings} currentRound={currentRound} /></>;
}
