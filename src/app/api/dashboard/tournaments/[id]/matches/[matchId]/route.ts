import { NextResponse } from "next/server";
import { canManageTournamentOperations, resolveDiscordActor } from "@/lib/discord-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string; matchId: string }> }) {
  const { matchId } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageTournamentOperations(actor.role)) return NextResponse.json({ error: "You do not have permission to report results." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const integer = (key: string) => typeof body?.[key] === "number" && Number.isInteger(body[key]) ? body[key] as number : null;
  const p1 = integer("playerOneGames"); const p2 = integer("playerTwoGames"); const draws = integer("gameDraws"); const version = integer("version");
  if (p1 === null || p2 === null || draws === null || version === null) return NextResponse.json({ error: "Complete the match result before submitting." }, { status: 400 });
  const { data, error } = await actor.supabase.rpc("report_tournament_match", { target_match_id: matchId, target_player_one_games: p1, target_player_two_games: p2, target_game_draws: draws, target_version: version });
  if (error) return NextResponse.json({ error: error.message.includes("changed") ? error.message : "Match result could not be saved." }, { status: 409 });
  return NextResponse.json({ ok: true, result: Array.isArray(data) ? data[0] : data });
}

