import {
  normalizeCollectorNumber,
  normalizeConditionFinish,
  normalizeProductName,
  normalizeSetName,
} from "./normalization.ts";

export type TcgplayerCatalogVariant = {
  tcgplayer_id: number;
  product_line: "Magic";
  set_name: string;
  product_name: string;
  title: string | null;
  collector_number: string | null;
  rarity: string | null;
  raw_condition: string;
  condition: string;
  finish: string;
  tcg_market_price: number | null;
  tcg_direct_low: number | null;
  tcg_low_price_with_shipping: number | null;
  tcg_low_price: number | null;
  tcg_marketplace_price: number | null;
  photo_url: string | null;
};

export type ResolveTcgplayerVariantInput = {
  productName: string;
  setName: string;
  collectorNumber?: string | null;
  condition: string;
  finish?: string | null;
};

export type ResolveTcgplayerVariantResult =
  | { status: "matched"; row: TcgplayerCatalogVariant; tcgplayerId: number }
  | { status: "ambiguous"; candidates: TcgplayerCatalogVariant[]; reason: string }
  | { status: "unresolved"; reason: string };

type SupabaseCatalogResolverClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (column: string, value: string) => ResolverQuery;
    };
  };
};

type ResolverQuery = PromiseLike<{
  data: TcgplayerCatalogVariant[] | null;
  error: { message?: string } | null;
}> & {
  eq: (column: string, value: string) => ResolverQuery;
  limit: (count: number) => ResolverQuery;
};

export async function resolveTcgplayerVariant(
  client: SupabaseCatalogResolverClient,
  input: ResolveTcgplayerVariantInput,
): Promise<ResolveTcgplayerVariantResult> {
  const normalizedSetName = normalizeSetName(input.setName);
  const normalizedProductName = normalizeProductName(input.productName);
  const normalizedCollectorNumber = normalizeCollectorNumber(input.collectorNumber);
  const normalized = normalizeConditionFinish(
    input.finish?.toLowerCase() === "foil" && !/\bfoil\b/i.test(input.condition)
      ? `${input.condition} Foil`
      : input.condition,
  );

  if (!normalizedSetName || !normalizedProductName) {
    return { status: "unresolved", reason: "Product name and set name are required." };
  }

  let query = client
    .from("tcgplayer_magic_catalog")
    .select("tcgplayer_id,product_line,set_name,product_name,title,collector_number,rarity,raw_condition,condition,finish,tcg_market_price,tcg_direct_low,tcg_low_price_with_shipping,tcg_low_price,tcg_marketplace_price,photo_url")
    .eq("normalized_set_name", normalizedSetName)
    .eq("normalized_product_name", normalizedProductName)
    .eq("normalized_condition", normalized.normalizedCondition)
    .eq("normalized_finish", normalized.normalizedFinish);

  if (normalizedCollectorNumber) {
    query = query.eq("normalized_collector_number", normalizedCollectorNumber);
  }

  const { data, error } = await query.limit(4);
  if (error) throw new Error(error.message ?? "Could not resolve TCGplayer variant.");
  const candidates = data ?? [];
  if (candidates.length === 1) {
    const [row] = candidates;
    return { status: "matched", row, tcgplayerId: row.tcgplayer_id };
  }
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      candidates,
      reason: normalizedCollectorNumber
        ? "Multiple TCGplayer variants matched the exact printing."
        : "Collector number is required to disambiguate matching TCGplayer variants.",
    };
  }

  return {
    status: "unresolved",
    reason: "No TCGplayer Magic catalog row matched the requested printing, condition, and finish.",
  };
}
