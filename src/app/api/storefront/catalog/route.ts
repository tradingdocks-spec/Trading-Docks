import { NextResponse } from "next/server";
import { getStorefrontCatalog, type StorefrontFilters } from "@/lib/showcase";

const FILTER_KEYS = ["game", "set", "cardType", "color", "rarity", "finish", "condition", "language", "tag"] as const;
const SORTS = new Set(["relevance", "price_asc", "price_desc", "newest", "name"]);

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const slug = (params.get("store") ?? "").trim().toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 64) {
    return NextResponse.json({ error: "Store is unavailable." }, { status: 404 });
  }

  const filters: StorefrontFilters = {};
  for (const key of FILTER_KEYS) {
    const values = params.getAll(key).map((value) => value.trim().slice(0, 80)).filter(Boolean).slice(0, 20);
    if (values.length) filters[key] = values;
  }
  const minPrice = params.get("minPrice") ?? "";
  const maxPrice = params.get("maxPrice") ?? "";
  if (/^\d+(\.\d{1,2})?$/.test(minPrice)) filters.minPrice = minPrice;
  if (/^\d+(\.\d{1,2})?$/.test(maxPrice)) filters.maxPrice = maxPrice;
  if (params.get("inStock") === "false") filters.inStock = "false";

  const ids = params.getAll("id").filter(Boolean).slice(0, 48);
  const requestedIds = ids.length ? ids : null;
  const sort = params.get("sort") ?? "relevance";
  try {
    const result = await getStorefrontCatalog(
      slug,
      (params.get("q") ?? "").trim().slice(0, 120),
      filters,
      SORTS.has(sort) ? sort : "relevance",
      requestedIds ? 48 : Math.min(Math.max(Number(params.get("size")) || 24, 1), 48),
      requestedIds ? 0 : Math.max(Number(params.get("offset")) || 0, 0),
      requestedIds,
    );
    if (!result) return NextResponse.json({ error: "Store is unavailable." }, { status: 404 });
    return NextResponse.json({
      items: result.cards, total: result.total, facets: result.facets,
      profile: { show_prices: result.profile.show_prices, show_quantities: result.profile.show_quantities },
    });
  } catch {
    return NextResponse.json({ error: "Store inventory is temporarily unavailable." }, { status: 503 });
  }
}
