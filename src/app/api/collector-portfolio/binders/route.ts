import { NextResponse } from "next/server";
import { slugifyPortfolioValue } from "@/lib/collector-portfolio";
import { createClient } from "@/lib/supabase/server";

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const locationId = String(body?.location_id ?? "").trim();
  const title = String(body?.title ?? "").trim().slice(0, 100);
  if (!locationId || !title) return NextResponse.json({ error: "Binder location and title are required." }, { status: 400 });

  const isFeatured = Boolean(body?.is_featured);
  if (isFeatured) await supabase.from("portfolio_binders").update({ is_featured: false }).eq("user_id", user.id);

  const row = {
    user_id: user.id,
    location_id: locationId,
    slug: slugifyPortfolioValue(String(body?.slug ?? title)),
    title,
    description: String(body?.description ?? "").trim().slice(0, 500),
    cover_type: String(body?.cover_type ?? "gradient"),
    cover_url: typeof body?.cover_url === "string" && body.cover_url ? body.cover_url : null,
    cover_color: String(body?.cover_color ?? "#172554").slice(0, 20),
    accent_color: String(body?.accent_color ?? "#67e8f9").slice(0, 20),
    visibility: ["private","unlisted","public"].includes(String(body?.visibility)) ? String(body?.visibility) : "private",
    portfolio_order: Number(body?.portfolio_order ?? 0),
    is_featured: isFeatured,
    is_trade_binder: Boolean(body?.is_trade_binder),
    show_values: body?.show_values !== false,
    show_conditions: body?.show_conditions !== false,
    show_finishes: body?.show_finishes !== false,
    show_pocket_locations: body?.show_pocket_locations !== false,
    favorite_page: typeof body?.favorite_page === "number" ? body.favorite_page : null,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase.from("portfolio_binders").upsert(row, { onConflict: "user_id,location_id" }).select("*").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ binder: data });
}
