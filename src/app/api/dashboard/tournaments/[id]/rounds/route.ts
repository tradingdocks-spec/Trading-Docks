import { NextResponse } from "next/server";
import { canManageTournamentOperations, resolveDiscordActor } from "@/lib/discord-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: rounds, error } = await actor.supabase.from("tournament_rounds").select("id,round_number,stage,status,started_at,ends_at,completed_at").eq("tournament_id", id).eq("workspace_id", actor.workspaceId).order("round_number");
  if (error) return NextResponse.json({ error: "Rounds could not be loaded." }, { status: 500 });
  const roundIds = (rounds ?? []).map((round) => round.id);
  const { data: matches, error: matchesError } = roundIds.length ? await actor.supabase.from("tournament_matches").select("id,round_id,match_number,player_one_id,player_two_id,is_bye,result_status,player_one_games_won,player_two_games_won,game_draws,player_one_match_points,player_two_match_points,version").in("round_id", roundIds).order("match_number") : { data: [], error: null };
  if (matchesError) return NextResponse.json({ error: "Matches could not be loaded." }, { status: 500 });
  return NextResponse.json({ rounds: rounds ?? [], matches: matches ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageTournamentOperations(actor.role)) return NextResponse.json({ error: "You do not have permission to manage pairings." }, { status: 403 });
  const body = await request.json().catch(() => null) as { roundNumber?: unknown } | null;
  const roundNumber = typeof body?.roundNumber === "number" && Number.isInteger(body.roundNumber) ? body.roundNumber : null;
  const { data, error } = await actor.supabase.rpc("generate_tournament_round", { target_tournament_id: id, target_round_number: roundNumber });
  if (error) return NextResponse.json({ error: "Pairings could not be generated." }, { status: 409 });
  return NextResponse.json({ ok: true, summary: Array.isArray(data) ? data[0] : data });
}
