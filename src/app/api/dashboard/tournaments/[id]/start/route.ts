import { NextResponse } from "next/server";
import { canManageTournamentOperations, resolveDiscordActor } from "@/lib/discord-access";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageTournamentOperations(actor.role)) return NextResponse.json({ error: "You do not have permission to start tournaments." }, { status: 403 });

  const body = await request.json().catch(() => null) as { plannedRounds?: unknown } | null;
  const plannedRounds = typeof body?.plannedRounds === "number" && Number.isInteger(body.plannedRounds) ? body.plannedRounds : null;
  const { data, error } = await actor.supabase.rpc("start_tournament", {
    target_tournament_id: id,
    target_planned_rounds: plannedRounds,
  });
  if (error) {
    const message = error.message ?? "Tournament could not be started.";
    const status = /not authorized|permission/i.test(message) ? 403 : /required|cannot be started|valid planned/i.test(message) ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
  const summary = Array.isArray(data) ? data[0] : data;
  return NextResponse.json({ ok: true, summary });
}
