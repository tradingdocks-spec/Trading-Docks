import { NextResponse } from "next/server";
import { sanitizeUsername } from "@/lib/collector-portfolio";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const username = sanitizeUsername(String(body?.username ?? ""));
  if (username.length < 3) return NextResponse.json({ error: "Username must be at least 3 characters." }, { status: 400 });

  const row = {
    user_id: user.id,
    username,
    display_name: String(body?.display_name ?? "Collector").trim().slice(0, 80) || "Collector",
    bio: String(body?.bio ?? "").trim().slice(0, 500),
    avatar_url: typeof body?.avatar_url === "string" && body.avatar_url ? body.avatar_url : null,
    banner_url: typeof body?.banner_url === "string" && body.banner_url ? body.banner_url : null,
    location: typeof body?.location === "string" && body.location ? body.location.slice(0, 100) : null,
    preferred_games: Array.isArray(body?.preferred_games) ? body.preferred_games.filter((value): value is string => typeof value === "string").slice(0, 8) : ["Magic: The Gathering"],
    theme: ["aurora","museum","midnight","collector"].includes(String(body?.theme)) ? String(body?.theme) : "aurora",
    is_public: Boolean(body?.is_public),
    show_collection_value: body?.show_collection_value !== false,
    show_location: Boolean(body?.show_location),
    featured_binder_id: typeof body?.featured_binder_id === "string" && body.featured_binder_id ? body.featured_binder_id : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("collector_profiles").upsert(row, { onConflict: "user_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That username is already taken." : error.message }, { status: 400 });
  return NextResponse.json({ profile: data });
}
