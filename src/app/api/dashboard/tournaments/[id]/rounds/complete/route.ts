import { NextResponse } from "next/server";
import { canManageTournamentOperations, resolveDiscordActor } from "@/lib/discord-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageTournamentOperations(actor.role)) return NextResponse.json({ error: "You do not have permission to complete rounds." }, { status: 403 });
  const body = await request.json().catch(() => null) as { roundId?: unknown } | null;
  if (typeof body?.roundId !== "string") return NextResponse.json({ error: "Round is required." }, { status: 400 });
  const { data, error } = await actor.supabase.rpc("complete_tournament_round", { target_round_id: body.roundId });
  if (error) return NextResponse.json({ error: error.message.includes("Every match") ? error.message : "Round could not be completed." }, { status: 409 });
  return NextResponse.json({ ok: true, tournamentId: id, summary: Array.isArray(data) ? data[0] : data });
}

