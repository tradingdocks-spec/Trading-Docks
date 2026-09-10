import { createClient } from "@/lib/supabase/server";

export type ShowcaseProfile = { display_name: string; description: string | null; logo_url: string | null; show_prices: boolean; show_quantities: boolean; allow_requests: boolean; };

export type ShowcaseCard = {
  public_id: string; game: string; name: string; set_name: string | null;
  set_code: string | null; collector_number: string | null; rarity: string | null;
  condition: string | null; finish: string | null; language: string | null;
  image_url: string | null; public_price: number | null; sellable_quantity: number;
};

export async function getShowcase(slug: string, query = "") {
  const supabase = await createClient();
  const { data: profile } = await supabase.from("showcase_profiles").select("*").eq("slug", slug).eq("enabled", true).maybeSingle();
  if (!profile) return null;
  const { data: cards, error } = await supabase.rpc("get_public_showcase_inventory", { requested_slug: slug, search_query: query || null, page_size: 48, page_offset: 0 });
  if (error) throw new Error("Showcase inventory is temporarily unavailable.");
  return { profile, cards: (cards ?? []) as ShowcaseCard[] };
}

export function money(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value) : "Price on request";
}
