import { NextResponse } from "next/server";
import { canManageTournamentOperations, resolveDiscordActor } from "@/lib/discord-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await actor.supabase.from("tournament_players").select("id,display_name,player_status,checked_in,seed_order").eq("tournament_id", id).eq("workspace_id", actor.workspaceId).order("seed_order");
  if (error) return NextResponse.json({ error: "Players could not be loaded." }, { status: 500 });
  return NextResponse.json({ players: data ?? [] });
}

export async function POST(_request: Request, { params }: { params: Promise<{ playerId: string }> }) {
  const { playerId } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageTournamentOperations(actor.role)) return NextResponse.json({ error: "You do not have permission to drop players." }, { status: 403 });
  const { data, error } = await actor.supabase.rpc("drop_tournament_player", { target_player_id: playerId });
  if (error) return NextResponse.json({ error: "Player could not be dropped." }, { status: 409 });
  return NextResponse.json({ ok: true, player: Array.isArray(data) ? data[0] : data });
}
