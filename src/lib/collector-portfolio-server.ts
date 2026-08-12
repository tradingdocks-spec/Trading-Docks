import type {
  CollectorProfile,
  PortfolioGameTotal,
  PortfolioBinder,
  PortfolioBinderView,
  PortfolioInventoryItem,
  PortfolioInventoryLocation,
  PortfolioProductTypeTotal,
} from "@/lib/collector-portfolio";
import { slugifyPortfolioValue } from "@/lib/collector-portfolio";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@supabase/supabase-js";

type PortfolioSupabaseClient = Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;

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
    gameId: normalizePortfolioGameId(value.gameId ?? value.game_id ?? value.game),
    game: portfolioGameLabel(value.gameId ?? value.game_id ?? value.game),
    productType: normalizePortfolioProductType(value.productType ?? value.product_type ?? value.itemKind ?? value.item_kind),
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
  return loadCollectorPortfolioForAuthenticatedUser(supabase, user);
}

export async function loadCollectorPortfolioForUser(user: User) {
  return loadCollectorPortfolioForAuthenticatedUser(createAdminClient(), user);
}

async function loadCollectorPortfolioForAuthenticatedUser(supabase: PortfolioSupabaseClient, user: User) {
  const [profileResult, bindersResult, locationsResult, itemsResult, featuredResult, tradeResult, requestsResult, wishlistResult] = await Promise.all([
    supabase.from("collector_profiles").select("*").eq("user_id", user.id).maybeSingle(),
    supabase.from("portfolio_binders").select("*").eq("user_id", user.id).order("portfolio_order"),
    supabase.from("inventory_locations").select("data").eq("user_id", user.id),
    supabase.from("inventory_items").select("data").eq("user_id", user.id),
    supabase.from("portfolio_featured_cards").select("*").eq("user_id", user.id).order("sort_order"),
    supabase.from("binder_card_trade_status").select("*").eq("user_id", user.id),
    supabase.from("trade_requests").select("*").or(`portfolio_owner_id.eq.${user.id},requester_user_id.eq.${user.id}`).order("updated_at", { ascending: false }),
    supabase.from("collector_wishlist").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
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
    tradeRequests: requestsResult.data ?? [],
    wishlist: wishlistResult.data ?? [],
    totals: {
      cards: items.reduce((sum, item) => sum + item.quantity, 0),
      uniqueCards: items.length,
      value: items.reduce((sum, item) => sum + item.value, 0),
      games: summarizePortfolioGames(items),
      productTypes: summarizePortfolioProductTypes(items),
      binders: binderViews.length,
      tradeCards: (tradeResult.data ?? []).filter((entry: { status?: string }) => entry.status === "available").length,
    },
  };
}

function summarizePortfolioGames(items: PortfolioInventoryItem[]): PortfolioGameTotal[] {
  const byGame = new Map<string, PortfolioGameTotal>();
  for (const item of items) {
    const gameId = item.gameId ?? "magic";
    const current = byGame.get(gameId) ?? {
      gameId,
      label: item.game ?? portfolioGameLabel(gameId),
      quantity: 0,
      uniqueItems: 0,
      value: 0,
    };
    current.quantity += item.quantity;
    current.uniqueItems += 1;
    current.value += item.value;
    byGame.set(gameId, current);
  }
  return [...byGame.values()];
}

function summarizePortfolioProductTypes(items: PortfolioInventoryItem[]): PortfolioProductTypeTotal[] {
  const byType = new Map<"card" | "sealed", PortfolioProductTypeTotal>();
  for (const item of items) {
    const productType = item.productType ?? "card";
    const current = byType.get(productType) ?? {
      productType,
      quantity: 0,
      uniqueItems: 0,
      value: 0,
    };
    current.quantity += item.quantity;
    current.uniqueItems += 1;
    current.value += item.value;
    byType.set(productType, current);
  }
  return [...byType.values()];
}

function normalizePortfolioGameId(value: unknown) {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (normalized === "pokemon" || normalized === "ptcg" || normalized === "pkm" || normalized === "3") return "pokemon";
  if (!normalized || normalized === "magic" || normalized === "mtg" || normalized === "magic: the gathering" || normalized === "1") return "magic";
  return normalized.replace(/[^a-z0-9-]+/g, "-") || "magic";
}

function portfolioGameLabel(value: unknown) {
  const gameId = normalizePortfolioGameId(value);
  if (gameId === "pokemon") return "Pokemon";
  if (gameId === "magic") return "Magic: The Gathering";
  return gameId
    .split("-")
    .filter(Boolean)
    .map((part) => part.slice(0, 1).toUpperCase() + part.slice(1))
    .join(" ") || "Unknown game";
}

function normalizePortfolioProductType(value: unknown): "card" | "sealed" {
  const normalized = typeof value === "string" ? value.trim().toLowerCase() : "";
  return normalized === "sealed" || normalized === "sealed_product" || normalized === "unopened"
    ? "sealed"
    : "card";
}
