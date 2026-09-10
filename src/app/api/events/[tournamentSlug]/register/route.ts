import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

type RegistrationBody = {
  playerName?: unknown;
  email?: unknown;
  phone?: unknown;
  discordUsername?: unknown;
  notes?: unknown;
  source?: unknown;
};

function text(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function POST(request: Request, { params }: { params: Promise<{ tournamentSlug: string }> }) {
  const { tournamentSlug } = await params;
  const body = await request.json().catch(() => null) as RegistrationBody | null;
  const playerName = text(body?.playerName, 120);
  if (playerName.length < 2) return NextResponse.json({ error: "Enter your name to register." }, { status: 400 });
  const email = text(body?.email, 240);
  if (email && !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase.rpc("register_for_tournament", {
      tournament_slug: decodeURIComponent(tournamentSlug),
      player_name: playerName,
      player_email: email || null,
      player_phone: text(body?.phone, 40) || null,
      player_discord_username: text(body?.discordUsername, 120) || null,
      player_notes: text(body?.notes, 500) || null,
      registration_source: ["discord", "direct", "qr", "other"].includes(body?.source as string) ? body?.source : "direct",
    });
    if (error) {
      const message = error.message ?? "Registration could not be completed.";
      const status = /full/i.test(message) ? 409 : /closed|not open/i.test(message) ? 422 : 400;
      return NextResponse.json({ error: message }, { status });
    }
    const registration = Array.isArray(data) ? data[0] : data;
    return NextResponse.json({ ok: true, registration });
  } catch (error) {
    console.error("Public tournament registration failed", { tournamentSlug, error: error instanceof Error ? error.message : error });
    return NextResponse.json({ error: "Registration could not be completed. Please try again." }, { status: 500 });
  }
}
