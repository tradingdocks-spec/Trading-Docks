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
  if (translated.status === "matched" && exactDirect.status === "ambiguous") {
    const narrowed = narrowToTranslatedSet(exactDirect, translated.name);
    if (narrowed.status === "matched") return narrowed;
  }
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
  if (exactTranslated.status === "ambiguous") {
    const narrowed = translated.status === "matched"
      ? narrowToTranslatedSet(exactTranslated, translated.name)
      : exactTranslated;
    return narrowed;
  }
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

function narrowToTranslatedSet(
  result: Extract<ResolveTcgplayerVariantResult, { status: "ambiguous" }>,
  translatedSetName: string,
): ResolveTcgplayerVariantResult {
  const wanted = normalizeSetName(translatedSetName);
  const candidates = result.candidates.filter((candidate) => normalizeSetName(candidate.set_name) === wanted);
  if (!candidates.length) return result;
  return selectCandidates(candidates, {
    ...result.diagnostics,
    translatedSetName,
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
  let productInSet = await fetchCandidates(client, {
    normalized_set_name: normalizedSetName,
    normalized_product_name: normalizedProductName,
  }, 1000);

  // ManaBox preserves the Scryfall display spelling while TCGplayer often
  // stores a compact product name (for example `C.A.M.P.` vs `CAMP`). When
  // the indexed exact name misses, use the set and collector number as a
  // bounded second lookup, then compare a compact identity locally. This is
  // deliberately constrained to one set and one printing identity so it
  // cannot silently select a card from another set.
  if (productInSet.length === 0 && normalizedCollectorNumber) {
    const byCardIdentity = (await Promise.all(nameLookupVariants(input.productName).map((normalizedName) =>
      fetchCandidates(client, {
        normalized_product_name: normalizedName,
        normalized_collector_number: normalizedCollectorNumber,
      }, 50),
    ))).flat();
    productInSet = uniqueCatalogRows(byCardIdentity).filter((row) => cardNamesEquivalent(row.product_name, input.productName));
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
    ? productInSet.filter((row: TcgplayerCatalogVariant) => collectorNumbersEquivalent(row.collector_number, input.collectorNumber) || printingNumber(row.collector_number) === printingNumber(input.collectorNumber))
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
  if (conditionCandidates.length === 0) {
    return unresolved("CONDITION_NOT_AVAILABLE", "Printing and finish were found, but the requested condition is not available in the TCGplayer catalog.", diagnostics);
  }

  return selectCandidates(conditionCandidates, diagnostics);
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

function nameLookupVariants(value: unknown) {
  const text = String(value ?? "");
  return [...new Set([
    normalizeProductName(text),
    ...text.split("//").map((face) => normalizeProductName(face)),
  ].filter(Boolean))];
}

function uniqueCatalogRows(rows: TcgplayerCatalogVariant[]) {
  return [...new Map(rows.map((row) => [row.tcgplayer_id, row])).values()];
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
