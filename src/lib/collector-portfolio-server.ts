import type {
  CollectorProfile,
  PortfolioBinder,
  PortfolioBinderView,
  PortfolioInventoryItem,
  PortfolioInventoryLocation,
} from "@/lib/collector-portfolio";
import { slugifyPortfolioValue } from "@/lib/collector-portfolio";
import { createClient } from "@/lib/supabase/server";

type DataRow = { data: unknown };

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function locationFrom(value: unknown): PortfolioInventoryLocation | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string") return null;
  return {
    id: value.id,
    name: value.name,
    type: typeof value.type === "string" ? value.type : "custom",
    description: typeof value.description === "string" ? value.description : "",
    binderColumns: typeof value.binderColumns === "number" ? value.binderColumns : 3,
    binderRows: typeof value.binderRows === "number" ? value.binderRows : 3,
    binderPages: typeof value.binderPages === "number" ? value.binderPages : 20,
  };
}

function itemFrom(value: unknown): PortfolioInventoryItem | null {
  if (!isRecord(value) || typeof value.id !== "string" || typeof value.name !== "string" || typeof value.locationId !== "string") return null;
  return {
    id: value.id,
    name: value.name,
    quantity: typeof value.quantity === "number" ? value.quantity : 1,
    locationId: value.locationId,
    value: typeof value.value === "number" ? value.value : 0,
    unitMarketValue: typeof value.unitMarketValue === "number" ? value.unitMarketValue : undefined,
    imageUrl: typeof value.imageUrl === "string" ? value.imageUrl : undefined,
    set: typeof value.set === "string" ? value.set : undefined,
    condition: typeof value.condition === "string" ? value.condition : undefined,
    finish: typeof value.finish === "string" ? value.finish : undefined,
    binderPage: typeof value.binderPage === "number" ? value.binderPage : undefined,
    binderSlot: typeof value.binderSlot === "string" ? value.binderSlot : undefined,
  };
}

export async function loadCollectorPortfolioForCurrentUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Authentication required.");

  const [profileResult, bindersResult, locationsResult, itemsResult, featuredResult, tradeResult] = await Promise.all([
    supabase.from("collector_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("portfolio_binders").select("*").eq("user_id", user.id).order("portfolio_order"),
    supabase.from("inventory_locations").select("data").eq("user_id", user.id),
    supabase.from("inventory_items").select("data").eq("user_id", user.id),
    supabase.from("portfolio_featured_cards").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("binder_card_trade_status").select("*").eq("user_id", user.id),
  ]);

  const locations = ((locationsResult.data ?? []) as DataRow[])
    .map((row) => locationFrom(row.data))
    .filter((value): value is PortfolioInventoryLocation => Boolean(value));
  const items = ((itemsResult.data ?? []) as DataRow[])
    .map((row) => itemFrom(row.data))
    .filter((value): value is PortfolioInventoryItem => Boolean(value));
  const binderLocations = locations.filter((location) => location.type === "binder");

  const existingBinders = (bindersResult.data ?? []) as PortfolioBinder[];
  const bindersByLocation = new Map(existingBinders.map((binder) => [binder.location_id, binder]));

  const generatedBinders: PortfolioBinder[] = binderLocations.map((location, index) => {
    const existing = bindersByLocation.get(location.id);
    return existing ?? {
      id: `draft-${location.id}`,
      user_id: user.id,
      location_id: location.id,
      slug: slugifyPortfolioValue(location.name),
      title: location.name,
      description: location.description ?? "",
      cover_type: "gradient",
      cover_url: null,
      cover_color: ["#172554", "#3b0764", "#052e2b", "#451a03"][index % 4],
      accent_color: ["#67e8f9", "#c4b5fd", "#6ee7b7", "#fcd34d"][index % 4],
      visibility: "private",
      portfolio_order: index,
      is_featured: index === 0,
      is_trade_binder: false,
      show_values: true,
      show_conditions: true,
      show_finishes: true,
      show_pocket_locations: true,
      favorite_page: null,
    };
  });

  const binderViews: PortfolioBinderView[] = generatedBinders.map((binder) => {
    const location = binderLocations.find((entry) => entry.id === binder.location_id)!;
    const cards = items
      .filter((item) => item.locationId === binder.location_id)
      .sort((a, b) => (a.binderPage ?? 999) - (b.binderPage ?? 999) || (a.binderSlot ?? "").localeCompare(b.binderSlot ?? ""));
    return {
      ...binder,
      location,
      cards,
      cardCount: cards.reduce((sum, card) => sum + card.quantity, 0),
      estimatedValue: cards.reduce((sum, card) => sum + card.value, 0),
      occupiedPockets: cards.filter((card) => card.binderPage && card.binderSlot).length,
      pageCount: location.binderPages ?? 20,
    };
  });

  const metadataName = typeof user.user_metadata?.full_name === "string"
    ? user.user_metadata.full_name
    : user.email?.split("@")[0] ?? "Collector";
  const fallbackUsername = (user.email?.split("@")[0] ?? `collector-${user.id.slice(0, 8)}`)
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 30);

  const profile = (profileResult.data as CollectorProfile | null) ?? {
    user_id: user.id,
    username: fallbackUsername.length >= 3 ? fallbackUsername : `collector-${user.id.slice(0, 8)}`,
    display_name: metadataName,
    bio: "",
    avatar_url: null,
    banner_url: null,
    location: null,
    preferred_games: ["Magic: The Gathering"],
    theme: "aurora",
    is_public: false,
    show_collection_value: true,
    show_location: false,
    featured_binder_id: null,
  };

  return {
    userId: user.id,
    email: user.email ?? "",
    profile,
    binders: binderViews,
    featuredCards: featuredResult.data ?? [],
    tradeStatuses: tradeResult.data ?? [],
    totals: {
      cards: items.reduce((sum, item) => sum + item.quantity, 0),
      uniqueCards: items.length,
      value: items.reduce((sum, item) => sum + item.value, 0),
      binders: binderViews.length,
      tradeCards: (tradeResult.data ?? []).filter((entry: { status?: string }) => entry.status === "available").length,
    },
  };
}
