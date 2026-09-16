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
import { catalogProductId, normalizeExternalId, parseListCollector, type CatalogPrinting, type PrintingLookupInput } from "./printing-identity.ts";

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
  tcgplayerId?: string | null;
  tcgplayerProductId?: string | null;
  lookupPrinting?: (input: PrintingLookupInput) => Promise<CatalogPrinting | null>;
  setIdentities?: MtgSetIdentity[];
};

export type TcgplayerResolveReasonCode =
  | "UNSUPPORTED_GAME"
  | "UNKNOWN_SET_CODE"
  | "PLST_COMPOUND_COLLECTOR_UNRESOLVED"
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
  stage: "direct" | "set-code-bridge" | "printing-identity" | "special-printing" | "external-id" | "name-fallback";
  sourceSet?: string | null;
  translatedSetName?: string | null;
  collectorNumber?: string | null;
  normalizedCondition?: string;
  normalizedFinish?: string;
  sourceSetCode?: string;
  sourceCollectorNumber?: string;
  tcgplayerProductId?: string;
  lookupError?: string;
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
  const normalized = normalizeConditionFinish(
    input.finish?.toLowerCase() === "foil" && !/\bfoil\b/i.test(input.condition)
      ? `${input.condition} Foil`
      : input.condition,
  );

  const diagnostics: TcgplayerResolveDiagnostics = {
    stage: "direct", sourceSet: input.setCode || input.setName,
    collectorNumber: input.collectorNumber,
    normalizedCondition: normalized.normalizedCondition, normalizedFinish: normalized.normalizedFinish,
  };
  const skuId = normalizeExternalId(input.tcgplayerId);
  if (skuId) {
    const rows = await fetchCandidates(client, { tcgplayer_id: skuId }, 1000);
    if (rows.length) return selectCandidates(rows, { ...diagnostics, stage: "external-id" });
  }
  const productId = normalizeExternalId(input.tcgplayerProductId);
  if (productId) {
    const byPhoto = await fetchCandidates(client, { photo_url: `https://tcgplayer-cdn.tcgplayer.com/product/${productId}_200w.jpg` }, 1000);
    if (byPhoto.length) return selectCandidates(byPhoto, { ...diagnostics, stage: "external-id", tcgplayerProductId: productId });
  }
  if (productId && normalizedProductName) {
    const rows = await fetchCandidates(client, { normalized_product_name: normalizedProductName }, 1000);
    const linked = rows.filter((row) => catalogProductId(row.photo_url) === productId);
    if (linked.length) return selectCandidates(linked, { ...diagnostics, stage: "external-id", tcgplayerProductId: productId });
  }
  if ((input.scryfallId || productId) && input.lookupPrinting) {
    let printing: CatalogPrinting | null = null;
    try {
      printing = await input.lookupPrinting(input);
    } catch (error) {
      diagnostics.lookupError = error instanceof Error ? error.message : "Printing metadata unavailable.";
    }
    if (printing) {
      const result = await matchLinkedPrinting(client, printing, input, { ...diagnostics, stage: "external-id" });
      const compound = /^(plst|list|the list|the list reprints)$/i.test(input.setCode?.trim() || input.setName?.trim() || "") ? parseListCollector(input.collectorNumber) : null;
      if (compound && result.status === "unresolved" && result.reasonCode === "PRINTING_NOT_FOUND") {
        return unresolved("PLST_COMPOUND_COLLECTOR_UNRESOLVED", "The List product link was found, but its seller catalog row is unavailable.", { ...result.diagnostics, ...compound });
      }
      return result;
    }
  }
  if (!normalizedProductName) {
    return unresolved("MISSING_REQUIRED_FIELD", "Product name or a resolvable external identifier is required.", {
      stage: "direct",
      sourceSet: input.setCode || input.setName,
      collectorNumber: input.collectorNumber,
      normalizedCondition: normalized.normalizedCondition,
      normalizedFinish: normalized.normalizedFinish,
    });
  }

  if (!(input.setName || input.setCode)) {
    const candidates = await fetchCandidates(client, { normalized_product_name: normalizedProductName }, 1000);
    return selectCandidates(candidates.filter((row) => !input.collectorNumber || normalizeCollectorNumber(row.collector_number) === normalizeCollectorNumber(input.collectorNumber)), { ...diagnostics, stage: "name-fallback" });
  }

  const directSetName = input.setName?.trim() || input.setCode?.trim() || "";
  const exactDirect = await exactMatch(client, directSetName, input, normalized.normalizedCondition, normalized.normalizedFinish);
  if (exactDirect.status === "matched") return exactDirect;

  const identities = input.setIdentities ?? fallbackMtgSetIdentities();
  const sourceSet = input.setCode?.trim() || input.setName?.trim() || "";
  const translated = resolveMtgSetIdentity(sourceSet, identities);
  const isList = [sourceSet, input.setName].some((value) => /^(plst|list|the list|the list reprints)$/i.test(value?.trim() ?? "")) || (translated.status === "matched" && translated.code === "plst");
  const compound = isList ? parseListCollector(input.collectorNumber) : null;
  let exactTranslated: ResolveTcgplayerVariantResult = exactDirect;
  if (translated.status === "matched" && normalizeSetName(translated.name) !== normalizeSetName(directSetName)) {
    exactTranslated = await exactMatch(client, translated.name, input, normalized.normalizedCondition, normalized.normalizedFinish, {
      stage: "set-code-bridge", sourceSet, translatedSetName: translated.name,
    });
    if (exactTranslated.status === "matched") return exactTranslated;
  }
  if (compound) {
    const specialDiagnostics: TcgplayerResolveDiagnostics = { ...diagnostics, stage: "special-printing", ...compound };
    let printing: CatalogPrinting | null | undefined;
    try {
      printing = await input.lookupPrinting?.({ ...input, setCode: "plst" });
    } catch (error) {
      specialDiagnostics.lookupError = error instanceof Error ? error.message : "Printing metadata unavailable.";
    }
    if (printing) {
      const result = await matchLinkedPrinting(client, printing, input, specialDiagnostics);
      if (result.status !== "unresolved" || ["FINISH_NOT_AVAILABLE", "CONDITION_NOT_AVAILABLE"].includes(result.reasonCode)) return result;
    }
    return unresolved("PLST_COMPOUND_COLLECTOR_UNRESOLVED", `The List printing could not be linked to a catalog product (source ${compound.sourceSetCode.toUpperCase()} #${compound.sourceCollectorNumber}).`, specialDiagnostics);
  }
  if (exactTranslated.status === "ambiguous") return exactTranslated;
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

// Compare Magic's printed number (optionally zero padded or followed by set size).
// Compound List identifiers retain their prefix and are resolved separately.
function printingNumber(value: string | null | undefined) {
  const number = normalizeCollectorNumber(value);
  const numeric = number?.match(/^0*(\d+)([a-z★]?)(?:\/\d+)?$/);
  return numeric ? `${Number(numeric[1])}${numeric[2]}` : number;
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

  const { data, error } = await query.limit(1000);
  if (error) throw new Error(error.message ?? "Could not resolve TCGplayer variant.");
  return selectCandidates(data ?? [], {
    stage: diagnostics.stage ?? "direct", sourceSet: diagnostics.sourceSet ?? setName,
    translatedSetName: diagnostics.translatedSetName, collectorNumber: input.collectorNumber,
    normalizedCondition, normalizedFinish,
  });
}

async function matchLinkedPrinting(
  client: SupabaseCatalogResolverClient,
  printing: CatalogPrinting,
  input: ResolveTcgplayerVariantInput,
  diagnostics: TcgplayerResolveDiagnostics,
) {
  const rows = await fetchCandidates(client, {
    normalized_set_name: normalizeSetName(printing.setName),
    normalized_product_name: normalizeProductName(printing.productName),
  }, 1000);
  const linked = rows.filter((row) => {
    const id = catalogProductId(row.photo_url);
    return id ? id === printing.productId : normalizeCollectorNumber(row.collector_number) === normalizeCollectorNumber(printing.collectorNumber);
  });
  return selectCandidates(linked, {
    ...diagnostics, collectorNumber: input.collectorNumber,
    translatedSetName: printing.setName, tcgplayerProductId: printing.productId,
  });
}

function selectCandidates(rows: TcgplayerCatalogVariant[], diagnostics: TcgplayerResolveDiagnostics): ResolveTcgplayerVariantResult {
  if (!rows.length) return unresolved("PRINTING_NOT_FOUND", "No catalog printing matched the source identity.", diagnostics);
  const finish = rows.filter((row) => normalizeSetName(row.finish) === diagnostics.normalizedFinish);
  if (!finish.length) return unresolved("FINISH_NOT_AVAILABLE", "Printing found, but the requested finish is unavailable.", diagnostics);
  const condition = finish.filter((row) => normalizeSetName(row.condition) === diagnostics.normalizedCondition);
  if (!condition.length) return unresolved("CONDITION_NOT_AVAILABLE", "Printing found, but the requested condition is unavailable.", diagnostics);
  const identities = new Map<string, TcgplayerCatalogVariant[]>();
  for (const row of condition) {
    const key = JSON.stringify([
      normalizeSetName(row.set_name), normalizeProductName(row.product_name),
      printingNumber(row.collector_number), catalogProductId(row.photo_url),
    ]);
    identities.set(key, [...(identities.get(key) ?? []), row]);
  }
  const candidates = [...identities.values()].map((variants) => variants.sort((a, b) => a.tcgplayer_id - b.tcgplayer_id)[0]);
  if (candidates.length > 1) return {
    status: "ambiguous", candidates, reasonCode: "AMBIGUOUS_PRINTING",
    reason: "Multiple distinct catalog printing identities remain after source constraints.", diagnostics,
  };
  const row = candidates[0];
  return { status: "matched", row, tcgplayerId: row.tcgplayer_id, diagnostics: { ...diagnostics, translatedSetName: row.set_name } };
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
  const productInSet = await fetchCandidates(client, {
    normalized_set_name: normalizedSetName,
    normalized_product_name: normalizedProductName,
  }, 1000);

  if (productInSet.length === 0) {
    return unresolved("SET_MAPPED_NO_PRODUCT", `Set translated to ${setName}, but the product was not found in the TCGplayer catalog for that set.`, diagnostics);
  }

  const printingCandidates = normalizedCollectorNumber
    ? productInSet.filter((row: TcgplayerCatalogVariant) => printingNumber(row.collector_number) === printingNumber(input.collectorNumber))
    : productInSet;

  if (normalizedCollectorNumber && printingCandidates.length === 0) {
    return unresolved("COLLECTOR_NUMBER_MISMATCH", `Product was found in ${setName}, but collector number ${input.collectorNumber} did not match a TCGplayer catalog printing.`, diagnostics);
  }

  const finishCandidates = printingCandidates.filter((row: TcgplayerCatalogVariant) => normalizeSetName(row.finish) === normalizedFinish);
  if (finishCandidates.length === 0) {
    return unresolved("FINISH_NOT_AVAILABLE", "Printing found, but the requested finish is not available in the TCGplayer catalog.", diagnostics);
  }

  const conditionCandidates = finishCandidates.filter((row: TcgplayerCatalogVariant) => normalizeSetName(row.condition) === normalizedCondition);
  if (conditionCandidates.length === 0) {
    return unresolved("CONDITION_NOT_AVAILABLE", "Printing and finish were found, but the requested condition is not available in the TCGplayer catalog.", diagnostics);
  }

  return selectCandidates(conditionCandidates, diagnostics);
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
