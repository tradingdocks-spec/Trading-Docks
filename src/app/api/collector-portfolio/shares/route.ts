import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadCollectorPortfolioForCurrentUser } from "@/lib/collector-portfolio-server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Authentication required." }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    scope?: "page" | "spread" | "binder" | "portfolio";
    visibility?: "public" | "unlisted" | "private";
    page?: number;
    binderLocationId?: string | null;
  } | null;
  const scope = body?.scope ?? "binder";
  const visibility = body?.visibility ?? "unlisted";
  const portfolio = await loadCollectorPortfolioForCurrentUser();
  const binder = portfolio.binders.find((entry) => entry.location_id === body?.binderLocationId) ?? portfolio.binders[0];

  if (scope !== "portfolio" && !binder) return NextResponse.json({ error: "Choose a binder before sharing." }, { status: 400 });

  const sanitizeCard = (card: NonNullable<typeof binder>["cards"][number]) => ({
    name: card.name,
    quantity: card.quantity,
    value: binder?.show_values ? card.value : null,
    imageUrl: card.imageUrl ?? null,
    set: card.set ?? null,
    condition: binder?.show_conditions ? card.condition ?? null : null,
    finish: binder?.show_finishes ? card.finish ?? null : null,
    page: binder?.show_pocket_locations ? card.binderPage ?? null : null,
    slot: binder?.show_pocket_locations ? card.binderSlot ?? null : null,
  });

  const startPage = Math.max(1, Number(body?.page ?? 1));
  const selectedCards = scope === "page"
    ? binder!.cards.filter((card) => card.binderPage === startPage)
    : scope === "spread"
      ? binder!.cards.filter((card) => card.binderPage === startPage || card.binderPage === startPage + 1)
      : binder?.cards ?? [];

  const payload = scope === "portfolio" ? {
    profile: {
      username: portfolio.profile.username,
      displayName: portfolio.profile.display_name,
      bio: portfolio.profile.bio,
      location: portfolio.profile.show_location ? portfolio.profile.location : null,
      games: portfolio.profile.preferred_games,
      showCollectionValue: portfolio.profile.show_collection_value,
    },
    totals: {
      cards: portfolio.totals.cards,
      value: portfolio.profile.show_collection_value ? portfolio.totals.value : null,
      binders: portfolio.totals.binders,
    },
    binders: portfolio.binders
      .filter((entry) => entry.visibility !== "private")
      .map((entry) => ({
        slug: entry.slug,
        title: entry.title,
        description: entry.description,
        coverColor: entry.cover_color,
        accentColor: entry.accent_color,
        cardCount: entry.cardCount,
        value: entry.show_values ? entry.estimatedValue : null,
        isTradeBinder: entry.is_trade_binder,
      })),
  } : {
    profile: { username: portfolio.profile.username, displayName: portfolio.profile.display_name },
    scope,
    page: startPage,
    binder: {
      slug: binder!.slug,
      title: binder!.title,
      description: binder!.description,
      coverColor: binder!.cover_color,
      accentColor: binder!.accent_color,
      columns: binder!.location.binderColumns ?? 3,
      rows: binder!.location.binderRows ?? 3,
      pageCount: binder!.pageCount,
      cardCount: binder!.cardCount,
      value: binder!.show_values ? binder!.estimatedValue : null,
      isTradeBinder: binder!.is_trade_binder,
    },
    cards: selectedCards.map(sanitizeCard),
  };

  const token = crypto.randomUUID().replaceAll("-", "");
  const admin = createAdminClient();
  const { error } = await admin.from("portfolio_shares").insert({
    user_id: user.id,
    share_type: scope,
    resource_id: binder?.location_id ?? null,
    token,
    visibility,
    payload,
  });
  if (error) return NextResponse.json({ error: error.message.includes("portfolio_shares") ? "Run the Collector Portfolio migration first." : error.message }, { status: 500 });

  return NextResponse.json({ url: `${new URL(request.url).origin}/share/portfolio/${token}` });
}
