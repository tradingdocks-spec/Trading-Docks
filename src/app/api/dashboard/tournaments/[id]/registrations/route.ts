import { NextResponse } from "next/server";
import { canSendDiscord, resolveDiscordActor } from "@/lib/discord-access";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await actor.supabase.from("tournament_registrations").select("*").eq("workspace_id", actor.workspaceId).eq("tournament_id", id).order("status").order("registered_at");
  if (error) return NextResponse.json({ error: "Registrations could not be loaded." }, { status: 500 });
  return NextResponse.json({ registrations: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const actor = await resolveDiscordActor();
  if (!actor.user || !actor.workspaceId) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canSendDiscord(actor.role)) return NextResponse.json({ error: "You do not have permission to manage registrations." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const action = typeof body?.action === "string" ? body.action : "";
  const registrationId = typeof body?.registrationId === "string" ? body.registrationId : "";
  if (action === "cancel") {
    const { error } = await actor.supabase.rpc("cancel_tournament_registration", { target_registration_id: registrationId, target_tournament_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  } else if (["check_in", "undo_check_in", "no_show"].includes(action)) {
    const nextStatus = action === "check_in" ? "checked_in" : action === "undo_check_in" ? "registered" : "no_show";
    const { error } = await actor.supabase.rpc("update_tournament_registration_status", { target_registration_id: registrationId, target_tournament_id: id, next_status: nextStatus });
    if (error) return NextResponse.json({ error: "Registration status could not be updated." }, { status: 400 });
  } else if (action === "add") {
    const playerName = typeof body?.playerName === "string" ? body.playerName.trim().slice(0, 120) : "";
    if (playerName.length < 2) return NextResponse.json({ error: "Player name is required." }, { status: 400 });
    const { data: tournament } = await actor.supabase.from("tournaments").select("max_players").eq("id", id).eq("workspace_id", actor.workspaceId).maybeSingle();
    const { count } = await actor.supabase.from("tournament_registrations").select("id", { count: "exact", head: true }).eq("tournament_id", id).in("status", ["registered", "checked_in"]);
    if (tournament?.max_players && (count ?? 0) >= tournament.max_players) return NextResponse.json({ error: "This tournament is full." }, { status: 409 });
    const { error } = await actor.supabase.from("tournament_registrations").insert({ workspace_id: actor.workspaceId, tournament_id: id, player_name: playerName, email: typeof body?.email === "string" ? body.email.trim() : null, discord_username: typeof body?.discordUsername === "string" ? body.discordUsername.trim() : null, status: "registered", source: "other" });
    if (error) return NextResponse.json({ error: "Player could not be added." }, { status: 400 });
  } else return NextResponse.json({ error: "Unknown registration action." }, { status: 400 });
  return NextResponse.json({ ok: true });
}
