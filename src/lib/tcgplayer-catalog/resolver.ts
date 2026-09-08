import {
  fallbackMtgSetIdentities,
  resolveMtgSetIdentity,
  type MtgSetIdentity,
} from "../mtg/set-identity.ts";
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
  gameId?: string | number | null;
  productName: string;
  setName?: string | null;
  setCode?: string | null;
  collectorNumber?: string | null;
  condition: string;
  finish?: string | null;
  scryfallId?: string | null;
  setIdentities?: MtgSetIdentity[];
};

export type TcgplayerResolveReasonCode =
  | "UNSUPPORTED_GAME"
  | "UNKNOWN_SET_CODE"
  | "SET_MAPPED_NO_PRODUCT"
  | "COLLECTOR_NUMBER_MISMATCH"
  | "PRINTING_NOT_FOUND"
  | "FINISH_NOT_AVAILABLE"
  | "CONDITION_NOT_AVAILABLE"
  | "AMBIGUOUS_PRINTING"
  | "UNSUPPORTED_ETCHED"
  | "CATALOG_PRODUCT_MISSING"
  | "MISSING_REQUIRED_FIELD";

export type TcgplayerResolveDiagnostics = {
  stage: "direct" | "set-code-bridge" | "printing-identity";
  sourceSet?: string | null;
  translatedSetName?: string | null;
  collectorNumber?: string | null;
  normalizedCondition?: string;
  normalizedFinish?: string;
};

export type ResolveTcgplayerVariantResult =
  | { status: "matched"; row: TcgplayerCatalogVariant; tcgplayerId: number; diagnostics: TcgplayerResolveDiagnostics }
  | { status: "ambiguous"; candidates: TcgplayerCatalogVariant[]; reason: string; reasonCode: TcgplayerResolveReasonCode; diagnostics: TcgplayerResolveDiagnostics }
  | { status: "unresolved"; reason: string; reasonCode: TcgplayerResolveReasonCode; diagnostics: TcgplayerResolveDiagnostics };

export type SupabaseCatalogResolverClient = {
  from: (table: string) => {
    select: (columns: string) => ResolverQuery;
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
  if (!isMagicResolverGame(input.gameId)) {
    return unresolved("UNSUPPORTED_GAME", "The TCGplayer Magic resolver only supports Magic inventory rows.", {
      stage: "direct",
      sourceSet: input.setCode || input.setName,
      collectorNumber: input.collectorNumber,
    });
  }

  if (input.finish?.toLowerCase() === "etched") {
    return unresolved("UNSUPPORTED_ETCHED", "Etched foil SKU resolution is not supported by the current TCGplayer catalog contract.", {
      stage: "direct",
      sourceSet: input.setCode || input.setName,
    });
  }

  const normalizedProductName = normalizeProductName(input.productName);
  const normalizedCollectorNumber = normalizeCollectorNumber(input.collectorNumber);
  const normalized = normalizeConditionFinish(
    input.finish?.toLowerCase() === "foil" && !/\bfoil\b/i.test(input.condition)
      ? `${input.condition} Foil`
      : input.condition,
  );

  if (!normalizedProductName || !(input.setName || input.setCode)) {
    return unresolved("MISSING_REQUIRED_FIELD", "Product name and set name or set code are required.", {
      stage: "direct",
      sourceSet: input.setCode || input.setName,
      collectorNumber: input.collectorNumber,
      normalizedCondition: normalized.normalizedCondition,
      normalizedFinish: normalized.normalizedFinish,
    });
  }

  const directSetName = input.setName?.trim() || input.setCode?.trim() || "";
  const exactDirect = await exactMatch(client, directSetName, input, normalized.normalizedCondition, normalized.normalizedFinish);
  if (exactDirect.status !== "unresolved") return exactDirect;

  const identities = input.setIdentities ?? fallbackMtgSetIdentities();
  const sourceSet = input.setCode?.trim() || input.setName?.trim() || "";
  const translated = resolveMtgSetIdentity(sourceSet, identities);
  if (translated.status === "unknown") {
    return unresolved("UNKNOWN_SET_CODE", `Unknown Magic set code or set alias: ${sourceSet}.`, {
      stage: "set-code-bridge",
      sourceSet,
      collectorNumber: input.collectorNumber,
      normalizedCondition: normalized.normalizedCondition,
      normalizedFinish: normalized.normalizedFinish,
    });
  }

  const translatedSetName = translated.name;
  if (normalizeSetName(translatedSetName) !== normalizeSetName(directSetName)) {
    const exactTranslated = await exactMatch(client, translatedSetName, input, normalized.normalizedCondition, normalized.normalizedFinish, {
      stage: "set-code-bridge",
      sourceSet,
      translatedSetName,
    });
    if (exactTranslated.status !== "unresolved") return exactTranslated;
  }

  return diagnoseUnresolved(client, translatedSetName, input, normalized.normalizedCondition, normalized.normalizedFinish, {
    stage: "printing-identity",
    sourceSet,
    translatedSetName,
    collectorNumber: input.collectorNumber,
    normalizedCondition: normalized.normalizedCondition,
    normalizedFinish: normalized.normalizedFinish,
  });
}

function isMagicResolverGame(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return true;
  const normalized = String(value).trim().toLowerCase();
  return normalized === "magic" || normalized === "mtg" || normalized === "1" || normalized === "magic: the gathering";
}

async function exactMatch(
  client: SupabaseCatalogResolverClient,
  setName: string,
  input: ResolveTcgplayerVariantInput,
  normalizedCondition: string,
  normalizedFinish: string,
  diagnostics: Partial<TcgplayerResolveDiagnostics> = { stage: "direct", sourceSet: setName },
): Promise<ResolveTcgplayerVariantResult> {
  const normalizedSetName = normalizeSetName(setName);
  const normalizedProductName = normalizeProductName(input.productName);
  const normalizedCollectorNumber = normalizeCollectorNumber(input.collectorNumber);
  if (!normalizedSetName || !normalizedProductName) {
    return unresolved("MISSING_REQUIRED_FIELD", "Product name and set name are required.", {
      stage: diagnostics.stage ?? "direct",
      sourceSet: diagnostics.sourceSet ?? setName,
      translatedSetName: diagnostics.translatedSetName,
      collectorNumber: input.collectorNumber,
      normalizedCondition,
      normalizedFinish,
    });
  }

  let query = client
    .from("tcgplayer_magic_catalog")
    .select("tcgplayer_id,product_line,set_name,product_name,title,collector_number,rarity,raw_condition,condition,finish,tcg_market_price,tcg_direct_low,tcg_low_price_with_shipping,tcg_low_price,tcg_marketplace_price,photo_url")
    .eq("normalized_set_name", normalizedSetName)
    .eq("normalized_product_name", normalizedProductName)
    .eq("normalized_condition", normalizedCondition)
    .eq("normalized_finish", normalizedFinish);

  if (normalizedCollectorNumber) {
    query = query.eq("normalized_collector_number", normalizedCollectorNumber);
  }

  const { data, error } = await query.limit(4);
  if (error) throw new Error(error.message ?? "Could not resolve TCGplayer variant.");
  const candidates = data ?? [];
  if (candidates.length === 1) {
    const [row] = candidates;
    return {
      status: "matched",
      row,
      tcgplayerId: row.tcgplayer_id,
      diagnostics: {
        stage: diagnostics.stage ?? "direct",
        sourceSet: diagnostics.sourceSet ?? setName,
        translatedSetName: diagnostics.translatedSetName ?? row.set_name,
        collectorNumber: input.collectorNumber,
        normalizedCondition,
        normalizedFinish,
      },
    };
  }
  if (candidates.length > 1) {
    return {
      status: "ambiguous",
      candidates,
      reasonCode: "AMBIGUOUS_PRINTING",
      reason: normalizedCollectorNumber
        ? "Multiple TCGplayer variants matched the exact printing."
        : "Collector number is required to disambiguate matching TCGplayer variants.",
      diagnostics: {
        stage: diagnostics.stage ?? "direct",
        sourceSet: diagnostics.sourceSet ?? setName,
        translatedSetName: diagnostics.translatedSetName,
        collectorNumber: input.collectorNumber,
        normalizedCondition,
        normalizedFinish,
      },
    };
  }

  return unresolved("PRINTING_NOT_FOUND", "No TCGplayer Magic catalog row matched the requested printing, condition, and finish.", {
    stage: diagnostics.stage ?? "direct",
    sourceSet: diagnostics.sourceSet ?? setName,
    translatedSetName: diagnostics.translatedSetName,
    collectorNumber: input.collectorNumber,
    normalizedCondition,
    normalizedFinish,
  });
}

async function diagnoseUnresolved(
  client: SupabaseCatalogResolverClient,
  setName: string,
  input: ResolveTcgplayerVariantInput,
  normalizedCondition: string,
  normalizedFinish: string,
  diagnostics: TcgplayerResolveDiagnostics,
): Promise<ResolveTcgplayerVariantResult> {
  const normalizedSetName = normalizeSetName(setName);
  const normalizedProductName = normalizeProductName(input.productName);
  const normalizedCollectorNumber = normalizeCollectorNumber(input.collectorNumber);
  let productInSet = await fetchCandidates(client, {
    normalized_set_name: normalizedSetName,
    normalized_product_name: normalizedProductName,
  }, 8);

  // ManaBox preserves the Scryfall display spelling while TCGplayer often
  // stores a compact product name (for example `C.A.M.P.` vs `CAMP`). When
  // the indexed exact name misses, use the set and collector number as a
  // bounded second lookup, then compare a compact identity locally. This is
  // deliberately constrained to one set and one printing identity so it
  // cannot silently select a card from another set.
  if (productInSet.length === 0 && normalizedCollectorNumber) {
    const byCollector = await fetchCandidates(client, {
      normalized_collector_number: normalizedCollectorNumber,
    }, 50);
    productInSet = byCollector.filter((row) => cardNamesEquivalent(row.product_name, input.productName));
  }

  if (productInSet.length === 0) {
    const bySet = await fetchCandidates(client, { normalized_set_name: normalizedSetName }, 500);
    productInSet = bySet.filter((row) =>
      cardNamesEquivalent(row.product_name, input.productName)
      && (!normalizedCollectorNumber || collectorNumbersEquivalent(row.collector_number, input.collectorNumber)),
    );
  }

  if (productInSet.length === 0) {
    return unresolved("SET_MAPPED_NO_PRODUCT", `Set translated to ${setName}, but the product was not found in the TCGplayer catalog for that set.`, diagnostics);
  }

  const printingCandidates = normalizedCollectorNumber
    ? productInSet.filter((row: TcgplayerCatalogVariant) => collectorNumbersEquivalent(row.collector_number, input.collectorNumber))
    : productInSet;

  if (normalizedCollectorNumber && printingCandidates.length === 0) {
    // Some TCGplayer exports omit a collector suffix or use a different
    // numbering scheme for otherwise unique products. Accept that case only
    // when the set, card name, finish, and condition identify one SKU.
    const uniqueVariant = productInSet
      .filter((row) => normalizeSetName(row.finish) === normalizedFinish)
      .filter((row) => normalizeSetName(row.condition) === normalizedCondition);
    if (uniqueVariant.length === 1) {
      const [row] = uniqueVariant;
      return {
        status: "matched",
        row,
        tcgplayerId: row.tcgplayer_id,
        diagnostics: { ...diagnostics, collectorNumber: row.collector_number ?? input.collectorNumber },
      };
    }
    return unresolved("COLLECTOR_NUMBER_MISMATCH", `Product was found in ${setName}, but collector number ${input.collectorNumber} did not match a TCGplayer catalog printing.`, diagnostics);
  }

  const finishCandidates = printingCandidates.filter((row: TcgplayerCatalogVariant) => normalizeSetName(row.finish) === normalizedFinish);
  if (finishCandidates.length === 0) {
    return unresolved("FINISH_NOT_AVAILABLE", "Printing found, but the requested finish is not available in the TCGplayer catalog.", diagnostics);
  }

  const conditionCandidates = finishCandidates.filter((row: TcgplayerCatalogVariant) => normalizeSetName(row.condition) === normalizedCondition);
  if (conditionCandidates.length === 1) {
    const [row] = conditionCandidates;
    return {
      status: "matched",
      row,
      tcgplayerId: row.tcgplayer_id,
      diagnostics,
    };
  }
  if (conditionCandidates.length > 1) {
    return {
      status: "ambiguous",
      candidates: conditionCandidates,
      reason: "Multiple TCGplayer SKUs matched the normalized card identity; choose the exact printing.",
      reasonCode: "AMBIGUOUS_PRINTING",
      diagnostics,
    };
  }
  if (conditionCandidates.length === 0) {
    return unresolved("CONDITION_NOT_AVAILABLE", "Printing and finish were found, but the requested condition is not available in the TCGplayer catalog.", diagnostics);
  }

  return unresolved("PRINTING_NOT_FOUND", "No exact TCGplayer condition and finish SKU matched this source printing.", diagnostics);
}

function compactProductName(value: unknown) {
  return normalizeProductName(value).replace(/[^a-z0-9]/g, "");
}

function cardNamesEquivalent(left: unknown, right: unknown) {
  const leftVariants = nameVariants(left);
  const rightVariants = nameVariants(right);
  return leftVariants.some((value) => rightVariants.includes(value));
}

function nameVariants(value: unknown) {
  const text = String(value ?? "");
  return [...new Set([
    compactProductName(text),
    ...text.split("//").map((face) => compactProductName(face)),
  ].filter(Boolean))];
}

function collectorNumbersEquivalent(left: unknown, right: unknown) {
  const a = normalizeCollectorNumber(left);
  const b = normalizeCollectorNumber(right);
  if (!a || !b) return a === b;
  if (a === b) return true;

  // Catalog exports occasionally append a foil/variant marker (for example
  // `391★`) or a leading hash. Only treat those as equivalent when both
  // values reduce to the same numeric collector number; lettered variants
  // such as `12a` and `12b` remain distinct.
  const numeric = (value: string) => value.replace(/^#/, "").replace(/[★*]+$/, "");
  const numericA = numeric(a);
  const numericB = numeric(b);
  return /^\d+$/.test(numericA) && /^\d+$/.test(numericB)
    && Number.parseInt(numericA, 10) === Number.parseInt(numericB, 10);
}

async function fetchCandidates(
  client: SupabaseCatalogResolverClient,
  filters: Record<string, string>,
  limit: number,
) {
  let query = client
    .from("tcgplayer_magic_catalog")
    .select("tcgplayer_id,product_line,set_name,product_name,title,collector_number,rarity,raw_condition,condition,finish,tcg_market_price,tcg_direct_low,tcg_low_price_with_shipping,tcg_low_price,tcg_marketplace_price,photo_url");

  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { data, error } = await query.limit(limit);
  if (error) throw new Error(error.message ?? "Could not resolve TCGplayer variant diagnostics.");
  return data ?? [];
}

function unresolved(reasonCode: TcgplayerResolveReasonCode, reason: string, diagnostics: TcgplayerResolveDiagnostics): ResolveTcgplayerVariantResult {
  return { status: "unresolved", reasonCode, reason, diagnostics };
}
