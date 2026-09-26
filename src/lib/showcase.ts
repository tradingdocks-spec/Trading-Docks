import { createClient } from "@/lib/supabase/server";

export type ShowcaseProfile = {
  workspace_id?: string;
  slug: string;
  display_name: string;
  description: string | null;
  logo_url: string | null;
  show_prices: boolean;
  show_quantities: boolean;
};

export type ShowcaseCard = {
  public_id: string;
  inventory_item_id: string;
  position_id: string | null;
  store_slug: string;
  game: string;
  name: string;
  set_name: string | null;
  set_code: string | null;
  collector_number: string | null;
  rarity: string | null;
  type_line: string | null;
  card_type: string | null;
  subtypes: string[];
  colors: string[];
  keywords: string[];
  condition: string | null;
  finish: string | null;
  language: string | null;
  image_url: string | null;
  scryfall_id: string | null;
  provider_product_id: string | null;
  tcgplayer_product_id: number | null;
  storefront_listing_price: number | null;
  available_quantity: number;
  added_at: string;
  custom_tags: string[];
  // Compatibility fields used by the existing kiosk/Showcase component.
  public_price: number | null;
  sellable_quantity: number;
};

export type StorefrontFilters = {
  game?: string[];
  set?: string[];
  cardType?: string[];
  color?: string[];
  rarity?: string[];
  finish?: string[];
  condition?: string[];
  language?: string[];
  tag?: string[];
  minPrice?: string;
  maxPrice?: string;
  inStock?: string;
};

export type ShowcaseFacet = { value: string; count: number };
export type ShowcaseFacets = Record<string, ShowcaseFacet[]>;

type CatalogPayload = { profile?: ShowcaseProfile | null; items?: ShowcaseCard[]; total?: number; facets?: ShowcaseFacets };

export async function getShowcase(
  slug: string,
  query = "",
) {
  const result = await getStorefrontCatalog(slug, query, {}, "relevance", 48, 0);
  return result ? { profile: result.profile, cards: result.cards, total: result.total, facets: result.facets } : null;
}

export async function getStorefrontCatalog(
  slug: string,
  query = "",
  filters: StorefrontFilters = {},
  sortBy = "relevance",
  pageSize = 24,
  pageOffset = 0,
  requestedPublicIds: string[] | null = null,
) {
  const supabase = await createClient();
  const { data: rawCatalog, error } = await supabase.rpc("search_public_storefront_catalog", {
      requested_slug: slug, search_query: query || null,
      selected_filters: requestedPublicIds ? { ...filters, inStock: "false" } : filters,
      sort_by: sortBy, page_size: pageSize, page_offset: pageOffset,
      requested_public_ids: requestedPublicIds,
    });
  if (error) throw new Error("Store inventory is temporarily unavailable.");
  const payload = (rawCatalog ?? {}) as CatalogPayload;
  if (!payload.profile) return null;
  const cards = (Array.isArray(payload.items) ? payload.items : []).map((card) => ({
    ...card, public_price: card.storefront_listing_price, sellable_quantity: card.available_quantity,
  }));
  return { profile: payload.profile, cards, total: Number(payload.total ?? 0), facets: payload.facets ?? {} };
}

export function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value)
    : "Price not set";
}
