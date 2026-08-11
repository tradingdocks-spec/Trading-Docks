import {
  createTcgTrackingClient,
  TCGTRACKING_MAGIC_CATEGORY_ID,
  TcgTrackingProviderError,
  type TcgTrackingClient,
} from "./client.ts";
import {
  reconcileTcgTrackingProduct,
  summarizePricingDeltas,
  type TcgTrackingLocalCatalogRow,
  type TcgTrackingPricingDeltaSummary,
  type TcgTrackingProductReconciliation,
} from "./reconciliation.ts";
import type {
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingSet,
  TcgTrackingSku,
} from "./types.ts";

export const TCGTRACKING_CATALOG_RECONCILIATION_DEFAULT_SAMPLE_SIZE = 150;
export const TCGTRACKING_CATALOG_RECONCILIATION_MAX_SAMPLE_SIZE = 250;
export const TCGTRACKING_CATALOG_RECONCILIATION_DEFAULT_CONFLICT_LIMIT = 25;
export const TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS =
  "tcgplayer_id,set_name,product_name,collector_number,condition,finish,tcg_market_price,tcg_low_price,photo_url";
export const TCGTRACKING_LOCAL_CATALOG_SMOKE_COLUMNS = "tcgplayer_id";
export const TCGTRACKING_LOCAL_CATALOG_SKU_QUERY_CHUNK_SIZE = 500;

export type TcgTrackingSupabaseErrorDetails = {
  message: string;
  code?: string;
  details?: string;
  hint?: string;
  status?: number;
  statusCode?: number;
  raw?: unknown;
};

export type TcgTrackingLocalCatalogStatus = {
  status: "available" | "failed";
  table: "tcgplayer_magic_catalog";
  schema: "ready" | "failed";
  smokeQuery: "tcgplayer_id limit 1";
  sampleRowAvailable: boolean;
  requestedColumns: string;
  rows?: number | null;
  error?: TcgTrackingSupabaseErrorDetails;
};

type TcgTrackingCatalogQueryResult<TData> = PromiseLike<{
  data: TData | null;
  error: unknown;
}>;

export type TcgTrackingCatalogReadClient = {
  from: (table: "tcgplayer_magic_catalog") => {
    select: (columns: string) => {
      in: (column: "tcgplayer_id", values: number[]) =>
        TcgTrackingCatalogQueryResult<TcgTrackingLocalCatalogRow[]>;
      limit: (count: number) => TcgTrackingCatalogQueryResult<Array<{ tcgplayer_id: number }>>;
    };
  };
};

export type TcgTrackingCatalogReconciliationRecommendation =
  | "green"
  | "yellow"
  | "red";

export type TcgTrackingCatalogConflict = {
  productId: number | null;
  skuId?: number;
  field: string;
  type: "identity" | "condition" | "finish" | "language" | "pricing";
  local: unknown;
  provider: unknown;
};

export type TcgTrackingCatalogReconciliationReport = {
  status: "completed" | "provider_failed" | "catalog_read_failed";
  readiness: "FAILED" | "GREEN" | "YELLOW" | "RED";
  generatedAt: string;
  sampleSize: number;
  categoryId: string;
  productsTested: number;
  providerSkusTested: number;
  localSkuRowsFound: number;
  exactSkuMatches: number;
  missingLocalSkus: number;
  missingProviderSkus: number;
  exactSkuMatchRate: number | null;
  recommendation: TcgTrackingCatalogReconciliationRecommendation | null;
  conflictBreakdown: Record<TcgTrackingCatalogConflict["type"], number>;
  pricingDeltaSummary: TcgTrackingPricingDeltaSummary;
  manapoolCoverage: {
    exactMatchesWithManapoolLow: number;
    providerSkusWithManapoolLow: number;
  };
  conflicts: TcgTrackingCatalogConflict[];
  error?: string;
  failure?: {
    stage: string;
    method?: string;
    url?: string;
    endpoint?: string;
    status?: number;
    statusCode?: number;
    contentType?: string | null;
    bodyPreview?: string;
    table?: string;
    requestedColumns?: string;
    code?: string;
    details?: string;
    hint?: string;
    message: string;
  };
  localCatalog: TcgTrackingLocalCatalogStatus;
};

export async function runTcgTrackingCatalogReconciliation(
  database: TcgTrackingCatalogReadClient,
  input: {
    sampleSize?: number;
    conflictLimit?: number;
    client?: Pick<TcgTrackingClient, "sets" | "cards" | "skus" | "pricing">;
  } = {},
): Promise<TcgTrackingCatalogReconciliationReport> {
  const sampleSize = boundedSampleSize(input.sampleSize);
  const conflictLimit = boundedConflictLimit(input.conflictLimit);
  const client = input.client ?? createTcgTrackingClient();
  const generatedAt = new Date().toISOString();
  let localCatalog = unavailableLocalCatalogStatus("Not checked.");

  try {
    localCatalog = await loadTcgTrackingLocalCatalogStatus(database);
    if (localCatalog.status === "failed") {
      throw new TcgTrackingCatalogReadError(localCatalog.error, {
        requestedColumns: TCGTRACKING_LOCAL_CATALOG_SMOKE_COLUMNS,
        queryStage: "local-catalog-smoke",
      });
    }
    const providerSample = await loadProviderSample(client, sampleSize);
    const skuIds = uniqueProviderSkuIds(providerSample.products);
    const localRows = await loadLocalCatalogRows(database, skuIds);
    const reconciliations = providerSample.products.map((entry) =>
      reconcileTcgTrackingProduct({
        providerProduct: entry.product,
        providerSkus: entry.skus,
        priceSnapshots: entry.pricing,
        localRows,
      }),
    );

    return summarizeCatalogReconciliation({
      generatedAt,
      sampleSize,
      categoryId: TCGTRACKING_MAGIC_CATEGORY_ID,
      reconciliations,
      localRows,
      conflictLimit,
      localCatalog,
    });
  } catch (error) {
    const failure = serializeCatalogReconciliationFailure(error);
    console.warn("TCGTracking catalog reconciliation failed", failure);
    return emptyFailureReport({
      status: failure.stage === "local-catalog-read"
        ? "catalog_read_failed"
        : "provider_failed",
      generatedAt,
      sampleSize,
      error: failure.message,
      failure,
      localCatalog: failure.stage === "local-catalog-read"
        ? failedLocalCatalogStatus(failure)
        : localCatalog,
    });
  }
}

export function summarizeCatalogReconciliation(input: {
  generatedAt: string;
  sampleSize: number;
  categoryId: string;
  reconciliations: TcgTrackingProductReconciliation[];
  localRows: TcgTrackingLocalCatalogRow[];
  conflictLimit?: number;
  localCatalog?: TcgTrackingLocalCatalogStatus;
}): TcgTrackingCatalogReconciliationReport {
  const providerSkusTested = input.reconciliations.reduce(
    (sum, product) => sum + product.providerSkuCount,
    0,
  );
  const exactSkuMatches = input.reconciliations.reduce(
    (sum, product) => sum + product.exactMatches,
    0,
  );
  const conflicts = input.reconciliations.flatMap((product) =>
    product.conflicts.map((conflict): TcgTrackingCatalogConflict => ({
      productId: product.providerProductId,
      skuId: product.skuMatches.find((match) =>
        match.providerProductId === product.providerProductId &&
        (
          match.condition === conflict.provider ||
          match.finish === conflict.provider ||
          match.language === conflict.provider
        )
      )?.providerSkuId,
      type: conflict.type,
      field: conflict.field,
      provider: conflict.provider,
      local: conflict.local,
    })),
  );
  const conflictBreakdown = countConflicts(conflicts);
  const exactSkuMatchRate = providerSkusTested
    ? roundPercent(exactSkuMatches / providerSkusTested)
    : null;
  const recommendation = classifyTcgTrackingCatalogReadiness({
    exactSkuMatchRate,
    conflictBreakdown,
  });
  const skuMatches = input.reconciliations.flatMap((product) => product.skuMatches);

  return {
    status: "completed",
    readiness: recommendation.toUpperCase() as TcgTrackingCatalogReconciliationReport["readiness"],
    generatedAt: input.generatedAt,
    sampleSize: input.sampleSize,
    categoryId: input.categoryId,
    productsTested: input.reconciliations.length,
    providerSkusTested,
    localSkuRowsFound: input.localRows.length,
    exactSkuMatches,
    missingLocalSkus: input.reconciliations.reduce(
      (sum, product) => sum + product.missingLocalSkus,
      0,
    ),
    missingProviderSkus: input.reconciliations.reduce(
      (sum, product) => sum + product.missingProviderSkus,
      0,
    ),
    exactSkuMatchRate,
    recommendation,
    conflictBreakdown,
    pricingDeltaSummary: summarizePricingDeltas(input.reconciliations),
    localCatalog: input.localCatalog ?? {
      status: "available",
      table: "tcgplayer_magic_catalog",
      schema: "ready",
      smokeQuery: "tcgplayer_id limit 1",
      sampleRowAvailable: input.localRows.length > 0,
      requestedColumns: TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS,
      rows: null,
    },
    manapoolCoverage: {
      exactMatchesWithManapoolLow: skuMatches.filter((match) =>
        match.matchType === "tcgplayer_sku_id" &&
        match.pricingDelta.manapoolLow != null
      ).length,
      providerSkusWithManapoolLow: skuMatches.filter((match) =>
        match.pricingDelta.manapoolLow != null
      ).length,
    },
    conflicts: conflicts.slice(0, boundedConflictLimit(input.conflictLimit)),
  };
}

export function classifyTcgTrackingCatalogReadiness(input: {
  exactSkuMatchRate: number | null;
  conflictBreakdown: Record<TcgTrackingCatalogConflict["type"], number>;
}): TcgTrackingCatalogReconciliationRecommendation {
  const rate = input.exactSkuMatchRate ?? 0;
  const systemicConflicts =
    input.conflictBreakdown.identity > 0 ||
    input.conflictBreakdown.condition > 0 ||
    input.conflictBreakdown.finish > 0;
  if (rate >= 98 && !systemicConflicts) return "green";
  if (rate >= 95 && !systemicConflicts) return "yellow";
  return "red";
}

async function loadProviderSample(
  client: Pick<TcgTrackingClient, "sets" | "cards" | "skus" | "pricing">,
  sampleSize: number,
) {
  const sets = await client.sets(TCGTRACKING_MAGIC_CATEGORY_ID);
  const sampledSets = chooseSampleSets(sets);
  const products: Array<{
    product: TcgTrackingProduct;
    skus: TcgTrackingSku[];
    pricing: TcgTrackingPriceSnapshot[];
  }> = [];

  for (const set of sampledSets) {
    if (products.length >= sampleSize) break;
    const setId = set.id;
    console.info("TCGTracking catalog reconciliation fetching set", {
      stage: "tcgtracking-set-sample",
      categoryId: TCGTRACKING_MAGIC_CATEGORY_ID,
      setId,
      setCode: set.abbreviation,
    });
    const [cards, skus, pricing] = await Promise.all([
      client.cards(TCGTRACKING_MAGIC_CATEGORY_ID, setId),
      client.skus(TCGTRACKING_MAGIC_CATEGORY_ID, setId),
      client.pricing(TCGTRACKING_MAGIC_CATEGORY_ID, setId),
    ]);
    const skusByProduct = groupSkusByProduct(skus);
    const pricingByProduct = groupPricingByProduct(pricing);
    for (const product of cards) {
      if (products.length >= sampleSize) break;
      products.push({
        product: {
          ...product,
          setId: product.setId ?? set.id,
          setName: product.setName ?? set.name,
          setCode: product.setCode ?? set.abbreviation,
        },
        skus: skusByProduct.get(product.tcgplayerProductId ?? Number(product.providerProductId)) ?? [],
        pricing: pricingByProduct.get(product.tcgplayerProductId ?? Number(product.providerProductId)) ?? [],
      });
    }
  }

  return { products };
}

async function loadLocalCatalogRows(
  database: TcgTrackingCatalogReadClient,
  skuIds: number[],
) {
  if (!skuIds.length) return [];
  const rows: TcgTrackingLocalCatalogRow[] = [];
  for (const chunk of chunkValues(skuIds, TCGTRACKING_LOCAL_CATALOG_SKU_QUERY_CHUNK_SIZE)) {
    const result = await database
      .from("tcgplayer_magic_catalog")
      .select(TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS)
      .in("tcgplayer_id", chunk);
    if (result.error) {
      throw new TcgTrackingCatalogReadError(
        serializeSupabaseError(result.error),
        {
          requestedColumns: TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS,
          queryStage: "local-catalog-sku-query",
        },
      );
    }
    rows.push(...(result.data ?? []));
  }
  console.info("TCGTracking local catalog rows available", {
    stage: "local-catalog-read",
    rowCount: rows.length,
    requestedSkuCount: skuIds.length,
    chunkSize: TCGTRACKING_LOCAL_CATALOG_SKU_QUERY_CHUNK_SIZE,
  });
  return rows;
}

export async function loadTcgTrackingLocalCatalogStatus(
  database: TcgTrackingCatalogReadClient,
  rowCount?: number | null,
): Promise<TcgTrackingLocalCatalogStatus> {
  const result = await database
    .from("tcgplayer_magic_catalog")
    .select(TCGTRACKING_LOCAL_CATALOG_SMOKE_COLUMNS)
    .limit(1);
  if (result.error) {
    return {
      status: "failed",
      table: "tcgplayer_magic_catalog",
      schema: "failed",
      smokeQuery: "tcgplayer_id limit 1",
      sampleRowAvailable: false,
      requestedColumns: TCGTRACKING_LOCAL_CATALOG_SMOKE_COLUMNS,
      rows: rowCount ?? null,
      error: serializeSupabaseError(result.error),
    };
  }
  return {
    status: "available",
    table: "tcgplayer_magic_catalog",
    schema: "ready",
    smokeQuery: "tcgplayer_id limit 1",
    sampleRowAvailable: Boolean(result.data?.length),
    requestedColumns: TCGTRACKING_LOCAL_CATALOG_SELECT_COLUMNS,
    rows: rowCount ?? null,
  };
}

function chooseSampleSets(sets: TcgTrackingSet[]) {
  const preferred = ["FIN", "TDM", "DFT", "FDN", "DSK", "BLB", "MH3", "OTJ"];
  const byCode = new Map(
    sets.map((set) => [String(set.abbreviation ?? set.id).toUpperCase(), set]),
  );
  const chosen = preferred
    .map((code) => byCode.get(code))
    .filter((set): set is TcgTrackingSet => Boolean(set));
  for (const set of sets) {
    if (chosen.length >= 10) break;
    if (!chosen.some((entry) => entry.id === set.id)) chosen.push(set);
  }
  return chosen.length ? chosen : sets.slice(0, 10);
}

function groupSkusByProduct(skus: TcgTrackingSku[]) {
  const grouped = new Map<number, TcgTrackingSku[]>();
  for (const sku of skus) {
    const productId = sku.tcgplayerProductId;
    if (!productId) continue;
    grouped.set(productId, [...(grouped.get(productId) ?? []), sku]);
  }
  return grouped;
}

function groupPricingByProduct(pricing: TcgTrackingPriceSnapshot[]) {
  const grouped = new Map<number, TcgTrackingPriceSnapshot[]>();
  for (const snapshot of pricing) {
    const productId = snapshot.tcgplayerProductId;
    if (!productId) continue;
    grouped.set(productId, [...(grouped.get(productId) ?? []), snapshot]);
  }
  return grouped;
}

function uniqueProviderSkuIds(
  entries: Array<{ skus: TcgTrackingSku[] }>,
) {
  return [
    ...new Set(
      entries
        .flatMap((entry) => entry.skus)
        .map((sku) => sku.tcgplayerSkuId)
        .filter((value): value is number =>
          typeof value === "number" && Number.isSafeInteger(value),
        ),
    ),
  ];
}

function countConflicts(conflicts: TcgTrackingCatalogConflict[]) {
  return conflicts.reduce<Record<TcgTrackingCatalogConflict["type"], number>>(
    (counts, conflict) => ({
      ...counts,
      [conflict.type]: counts[conflict.type] + 1,
    }),
    { identity: 0, condition: 0, finish: 0, language: 0, pricing: 0 },
  );
}

function boundedSampleSize(value: unknown) {
  const parsed = typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : TCGTRACKING_CATALOG_RECONCILIATION_DEFAULT_SAMPLE_SIZE;
  return Math.max(
    1,
    Math.min(TCGTRACKING_CATALOG_RECONCILIATION_MAX_SAMPLE_SIZE, parsed),
  );
}

function boundedConflictLimit(value: unknown) {
  const parsed = typeof value === "number" && Number.isFinite(value)
    ? Math.trunc(value)
    : TCGTRACKING_CATALOG_RECONCILIATION_DEFAULT_CONFLICT_LIMIT;
  return Math.max(0, Math.min(100, parsed));
}

function roundPercent(value: number) {
  return Math.round(value * 10_000) / 100;
}

function emptyFailureReport(input: {
  status: "provider_failed" | "catalog_read_failed";
  generatedAt: string;
  sampleSize: number;
  error: string;
  failure: TcgTrackingCatalogReconciliationReport["failure"];
  localCatalog: TcgTrackingLocalCatalogStatus;
}): TcgTrackingCatalogReconciliationReport {
  return {
    status: input.status,
    readiness: "FAILED",
    generatedAt: input.generatedAt,
    sampleSize: input.sampleSize,
    categoryId: TCGTRACKING_MAGIC_CATEGORY_ID,
    productsTested: 0,
    providerSkusTested: 0,
    localSkuRowsFound: 0,
    exactSkuMatches: 0,
    missingLocalSkus: 0,
    missingProviderSkus: 0,
    exactSkuMatchRate: null,
    recommendation: null,
    conflictBreakdown: { identity: 0, condition: 0, finish: 0, language: 0, pricing: 0 },
    pricingDeltaSummary: {
      matchedSkuCount: 0,
      medianMarketDelta: null,
      medianLowDelta: null,
      maxMarketDelta: null,
      maxLowDelta: null,
      percentMarketWithinOnePercent: null,
      percentMarketWithinFivePercent: null,
      percentLowWithinOnePercent: null,
      percentLowWithinFivePercent: null,
      localNullPriceCount: 0,
      providerNullPriceCount: 0,
    },
    manapoolCoverage: {
      exactMatchesWithManapoolLow: 0,
      providerSkusWithManapoolLow: 0,
    },
    conflicts: [],
    error: input.error,
    failure: input.failure,
    localCatalog: input.localCatalog,
  };
}

function serializeCatalogReconciliationFailure(
  error: unknown,
): NonNullable<TcgTrackingCatalogReconciliationReport["failure"]> {
  if (error instanceof TcgTrackingProviderError) {
    return {
      stage: stageForProviderEndpoint(error.endpoint),
      method: error.method,
      url: error.url,
      endpoint: error.endpoint,
      status: error.status,
      contentType: error.contentType,
      bodyPreview: sanitizeBodyPreview(error.bodyPreview),
      message: error.message || "TCGTracking provider request failed.",
    };
  }
  if (error instanceof Error) {
    if (error instanceof TcgTrackingCatalogReadError) {
      return {
        stage: "local-catalog-read",
        table: "tcgplayer_magic_catalog",
        requestedColumns: error.context.requestedColumns,
        status: error.supabaseError?.status,
        statusCode: error.supabaseError?.statusCode,
        code: error.supabaseError?.code,
        details: error.supabaseError?.details,
        hint: error.supabaseError?.hint,
        message: error.message,
      };
    }
    return {
      stage: error.name === "TcgTrackingCatalogReadError"
        ? "local-catalog-read"
        : "catalog-reconciliation",
      message: error.message || "Catalog reconciliation failed.",
    };
  }
  return {
    stage: "catalog-reconciliation",
    message: String(error ?? "Catalog reconciliation failed."),
  };
}

function stageForProviderEndpoint(endpoint: string) {
  if (/\/sets\/?$/i.test(endpoint)) return "tcgtracking-sets";
  if (/\/cards(?:\?|$)/i.test(endpoint)) return "tcgtracking-products";
  if (/\/skus(?:\?|$)/i.test(endpoint)) return "tcgtracking-skus";
  if (/\/pricing(?:\?|$)/i.test(endpoint)) return "tcgtracking-pricing";
  return "tcgtracking-request";
}

function sanitizeBodyPreview(value: string | undefined) {
  if (!value) return undefined;
  return value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 220);
}

export function serializeSupabaseError(error: unknown): TcgTrackingSupabaseErrorDetails {
  if (error instanceof Error) {
    return {
      message: error.message || "Supabase catalog read failed.",
      raw: safeRawError(error),
    };
  }
  if (typeof error === "string") {
    return { message: error.trim() || "Supabase catalog read failed." };
  }
  if (error && typeof error === "object") {
    const source = error as Record<string, unknown>;
    const message = textValue(source.message) ??
      textValue(source.error) ??
      textValue(source.details) ??
      jsonFallback(source) ??
      "Supabase catalog read failed.";
    return {
      message,
      code: textValue(source.code),
      details: textValue(source.details),
      hint: textValue(source.hint),
      status: numberValue(source.status),
      statusCode: numberValue(source.statusCode),
      raw: safeRawError(source),
    };
  }
  return { message: String(error ?? "Supabase catalog read failed.") };
}

class TcgTrackingCatalogReadError extends Error {
  supabaseError?: TcgTrackingSupabaseErrorDetails;
  context: {
    requestedColumns: string;
    queryStage: string;
  };

  constructor(
    supabaseError: TcgTrackingSupabaseErrorDetails | undefined,
    context: { requestedColumns: string; queryStage: string },
  ) {
    super(`tcgplayer_magic_catalog read failed: ${supabaseError?.message ?? "Supabase catalog read failed."}`);
    this.name = "TcgTrackingCatalogReadError";
    this.supabaseError = supabaseError;
    this.context = context;
  }
}

function unavailableLocalCatalogStatus(message: string): TcgTrackingLocalCatalogStatus {
  return {
    status: "failed",
    table: "tcgplayer_magic_catalog",
    schema: "failed",
    smokeQuery: "tcgplayer_id limit 1",
    sampleRowAvailable: false,
    requestedColumns: TCGTRACKING_LOCAL_CATALOG_SMOKE_COLUMNS,
    rows: null,
    error: { message },
  };
}

function failedLocalCatalogStatus(
  failure: NonNullable<TcgTrackingCatalogReconciliationReport["failure"]>,
): TcgTrackingLocalCatalogStatus {
  return {
    status: "failed",
    table: "tcgplayer_magic_catalog",
    schema: "failed",
    smokeQuery: "tcgplayer_id limit 1",
    sampleRowAvailable: false,
    requestedColumns: failure.requestedColumns ?? TCGTRACKING_LOCAL_CATALOG_SMOKE_COLUMNS,
    rows: null,
    error: {
      message: failure.message,
      code: failure.code,
      details: failure.details,
      hint: failure.hint,
      status: failure.status,
      statusCode: failure.statusCode,
    },
  };
}

function chunkValues<TValue>(values: TValue[], size: number) {
  const chunks: TValue[][] = [];
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size));
  }
  return chunks;
}

function textValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function jsonFallback(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    return serialized && serialized !== "{}" ? serialized : undefined;
  } catch {
    return undefined;
  }
}

function safeRawError(error: object) {
  try {
    return JSON.parse(JSON.stringify(error)) as unknown;
  } catch {
    return undefined;
  }
}
