import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const RESERVED = new Set(["dashboard", "api", "auth", "login", "signup", "kiosk", "admin", "s", "settings", "account"]);
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  if (!slugPattern.test(slug) || slug.length < 3 || slug.length > 64 || RESERVED.has(slug)) return NextResponse.json({ error: "Choose a valid public slug." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preference?.active_workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "No active workspace." }, { status: 403 });
  const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(String(membership.role))) return NextResponse.json({ error: "Showcase settings require workspace admin access." }, { status: 403 });
  const { data, error } = await supabase.from("showcase_profiles").upsert({ workspace_id: workspaceId, enabled: body?.enabled === true, slug, display_name: typeof body?.displayName === "string" && body.displayName.trim() ? body.displayName.trim().slice(0, 120) : "Trading Docks Showcase", description: typeof body?.description === "string" ? body.description.trim().slice(0, 500) : null, allow_requests: body?.allowRequests !== false, show_prices: body?.showPrices !== false, show_quantities: body?.showQuantities !== false, kiosk_enabled: body?.kioskEnabled === true, minimum_price: typeof body?.minimumPrice === "number" && Number.isFinite(body.minimumPrice) ? Math.max(0, body.minimumPrice) : null }, { onConflict: "workspace_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That public slug is already in use." : "Settings could not be saved." }, { status: error.code === "23505" ? 409 : 400 });
  return NextResponse.json({ profile: data });
}
