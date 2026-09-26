import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { showcaseSlugError } from "@/lib/showcase-slug";

export async function PUT(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const slug = typeof body?.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const slugError = showcaseSlugError(slug);
  if (slugError) return NextResponse.json({ error: slugError }, { status: 400 });
  const displayName = typeof body?.displayName === "string" ? body.displayName.trim().slice(0, 120) : "";
  if (!displayName) return NextResponse.json({ error: "Display name is required." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data: preference } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  const workspaceId = preference?.active_workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "Unable to resolve your Trading Docks workspace." }, { status: 403 });
  const { data: membership } = await supabase.from("workspace_members").select("role").eq("workspace_id", workspaceId).eq("user_id", user.id).maybeSingle();
  if (!membership || !["owner", "admin"].includes(String(membership.role))) return NextResponse.json({ error: "Showcase settings require workspace admin access." }, { status: 403 });
  const { data: slugOwner, error: slugLookupError } = await supabase.from("storefront_profiles").select("workspace_id").eq("slug", slug).maybeSingle();
  if (slugLookupError) return NextResponse.json({ error: "Unable to validate public slug." }, { status: 503 });
  if (slugOwner && slugOwner.workspace_id !== workspaceId) return NextResponse.json({ error: "That public slug is already in use." }, { status: 409 });
  const { data, error } = await supabase.from("storefront_profiles").upsert({ workspace_id: workspaceId, enabled: body?.enabled === true, slug, display_name: displayName, description: typeof body?.description === "string" ? body.description.trim().slice(0, 500) : null, logo_url: typeof body?.logoUrl === "string" ? body.logoUrl.trim().slice(0, 1000) : null, show_prices: body?.showPrices !== false, show_quantities: body?.showQuantities !== false, minimum_price: typeof body?.minimumPrice === "number" && Number.isFinite(body.minimumPrice) ? Math.max(0, body.minimumPrice) : null }, { onConflict: "workspace_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.code === "23505" ? "That public slug is already in use." : "Settings could not be saved." }, { status: error.code === "23505" ? 409 : 400 });
  return NextResponse.json({ profile: data });
}
