import type { StorefrontFilters } from "@/lib/showcase";

export type StorefrontQuery = {
  q: string;
  sort: string;
  page: number;
  filters: StorefrontFilters;
};

const FILTER_KEYS = ["game", "set", "cardType", "color", "rarity", "finish", "condition", "language", "tag"] as const;
const ALLOWED_SORTS = new Set(["relevance", "price_asc", "price_desc", "newest", "name"]);

export function parseStorefrontQuery(searchParams: Record<string, string | string[] | undefined>): StorefrontQuery {
  const values = (key: string) => {
    const raw = searchParams[key];
    return (Array.isArray(raw) ? raw : raw ? [raw] : []).map((value) => value.trim().slice(0, 80)).filter(Boolean).slice(0, 20);
  };
  const filters: StorefrontFilters = {};
  for (const key of FILTER_KEYS) {
    const selected = values(key);
    if (selected.length) filters[key] = selected;
  }
  for (const key of ["minPrice", "maxPrice"] as const) {
    const value = values(key)[0] ?? "";
    if (/^\d+(\.\d{1,2})?$/.test(value)) filters[key] = value;
  }
  let q = typeof searchParams.q === "string" ? searchParams.q.trim().slice(0, 120) : "";
  if (!filters.maxPrice) {
    const under = q.match(/\b(?:under|below|less than)\s+\$?(\d+(?:\.\d{1,2})?)\b/i);
    if (under) {
      filters.maxPrice = under[1];
      q = q.replace(under[0], " ").replace(/\s+/g, " ").trim();
    }
  }
  if (!filters.minPrice) {
    const over = q.match(/\b(?:over|above|more than)\s+\$?(\d+(?:\.\d{1,2})?)\b/i);
    if (over) {
      filters.minPrice = over[1];
      q = q.replace(over[0], " ").replace(/\s+/g, " ").trim();
    }
  }
  if (searchParams.inStock === "false") filters.inStock = "false";
  const sortValue = typeof searchParams.sort === "string" ? searchParams.sort : "relevance";
  const pageValue = Number(typeof searchParams.page === "string" ? searchParams.page : 1);
  return {
    q,
    sort: ALLOWED_SORTS.has(sortValue) ? sortValue : "relevance",
    page: Number.isInteger(pageValue) ? Math.max(1, Math.min(pageValue, 10_000)) : 1,
    filters,
  };
}

export function buildStorefrontQuery(query: StorefrontQuery, page = query.page) {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.sort !== "relevance") params.set("sort", query.sort);
  for (const key of FILTER_KEYS) {
    const active = query.filters[key] ?? [];
    for (const value of active) params.append(key, value);
  }
  if (query.filters.minPrice) params.set("minPrice", query.filters.minPrice);
  if (query.filters.maxPrice) params.set("maxPrice", query.filters.maxPrice);
  if (query.filters.inStock === "false") params.set("inStock", "false");
  if (page > 1) params.set("page", String(page));
  return params.toString();
}
