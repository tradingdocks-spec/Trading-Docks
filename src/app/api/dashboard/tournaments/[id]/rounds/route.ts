import { NextResponse } from "next/server";
import { canManageTournamentOperations, resolveDiscordActor } from "@/lib/discord-access";

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

