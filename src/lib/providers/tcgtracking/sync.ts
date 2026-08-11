import {
  createTcgTrackingClient,
  type TcgTrackingClient,
} from "./client.ts";
import { normalizeCondition, normalizeFinish } from "./reconciliation.ts";
import type {
  TcgTrackingPriceSnapshot,
  TcgTrackingProduct,
  TcgTrackingSet,
} from "./types.ts";

export type TcgTrackingSyncType =
  | "product_mappings"
  | "price_snapshots"
  | "sample_reconciliation";

export type TcgTrackingSyncStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "paused";

export type TcgTrackingSyncRunRow = {
  id: string;
  category_id: string;
  sync_type: TcgTrackingSyncType;
  status: TcgTrackingSyncStatus;
  checkpoint: Record<string, unknown>;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  error_summary: string | null;
  started_at: string;
  completed_at: string | null;
  updated_at?: string;
};

export type TcgTrackingMappingRow = {
  category_id: string;
  tcgplayer_product_id: number;
  scryfall_id: string | null;
  mtgjson_uuid: string | null;
  cardmarket_id: string | null;
  cardtrader_id: string | null;
  image_url: string | null;
  provider_set_id: string | null;
  set_abbr: string | null;
  last_synced_at: string;
};

export type TcgTrackingPriceSnapshotRow = {
  category_id: string;
  tcgplayer_product_id: number;
  tcgplayer_sku_id: number | null;
  condition: string | null;
  finish: string | null;
  language: string | null;
  tcg_market: number | null;
  tcg_low: number | null;
  tcg_high: number | null;
  active_listing_count: number | null;
  manapool_low: number | null;
  observed_at: string;
};

export type TcgTrackingSyncClient = {
  from: (table: string) => {
    select: (columns: string) => TcgTrackingQuery;
    insert: (rows: unknown) => TcgTrackingQuery;
    upsert: (rows: unknown, options?: { onConflict?: string }) => TcgTrackingQuery;
    update: (values: unknown) => TcgTrackingQuery;
  };
};

type TcgTrackingQuery = PromiseLike<{
  data: unknown;
  error: {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  } | null;
}> & {
  select: (columns: string) => TcgTrackingQuery;
  eq: (column: string, value: unknown) => TcgTrackingQuery;
  in: (column: string, values: unknown[]) => TcgTrackingQuery;
  order: (column: string, options?: { ascending?: boolean }) => TcgTrackingQuery;
  limit: (count: number) => TcgTrackingQuery;
  single: () => TcgTrackingQuery;
};

export type AdvanceTcgTrackingSyncInput = {
  syncType: TcgTrackingSyncType;
  category?: string;
  setLimit?: number;
  productLimit?: number;
  client?: Pick<TcgTrackingClient, "sets" | "cards" | "pricing" | "meta">;
};

export type AdvanceTcgTrackingSyncResult = {
  status: "advanced" | "completed" | "schema_required" | "provider_failed";
  run?: TcgTrackingSyncRunRow | null;
  processed: number;
  inserted: number;
  updated: number;
  failed: number;
  currentSet?: string | null;
  message?: string;
};

const SYNC_MAGIC_CATEGORY_ID = "1";
export const TCGTRACKING_SYNC_SET_LIMIT = 1;
export const TCGTRACKING_SYNC_PRODUCT_LIMIT = 250;

export function mappingRowFromTcgTrackingProduct(
  product: TcgTrackingProduct,
  observedAt = new Date().toISOString(),
): TcgTrackingMappingRow | null {
  if (!product.tcgplayerProductId) return null;
  return {
    category_id: product.categoryId || SYNC_MAGIC_CATEGORY_ID,
    tcgplayer_product_id: product.tcgplayerProductId,
    scryfall_id: uuidOrNull(product.scryfallId),
    mtgjson_uuid: uuidOrNull(product.mtgjsonUuid),
    cardmarket_id: product.cardmarketId ?? null,
    cardtrader_id: product.cardtraderId ?? null,
    image_url: product.imageUrl ?? null,
    provider_set_id: product.setId ?? null,
    set_abbr: product.setCode ?? null,
    last_synced_at: observedAt,
  };
}

export function priceSnapshotRowFromTcgTracking(
  snapshot: TcgTrackingPriceSnapshot,
  categoryId = SYNC_MAGIC_CATEGORY_ID,
  observedAt = snapshot.updatedAt,
): TcgTrackingPriceSnapshotRow | null {
  if (!snapshot.tcgplayerProductId) return null;
  return {
    category_id: categoryId,
    tcgplayer_product_id: snapshot.tcgplayerProductId,
    tcgplayer_sku_id: snapshot.tcgplayerSkuId ?? null,
    condition: null,
    finish: normalizeFinish(snapshot.providerSkuId?.split(":").at(-1)) ?? null,
    language: null,
    tcg_market: snapshot.tcgMarket,
    tcg_low: snapshot.tcgLow,
    tcg_high: snapshot.tcgHigh,
    active_listing_count: snapshot.activeListings,
    manapool_low: snapshot.manapoolLow,
    observed_at: observedAt,
  };
}

export function skuPriceSnapshotRow(input: {
  categoryId?: string;
  tcgplayerProductId?: number;
  tcgplayerSkuId?: number;
  condition?: string;
  finish?: string;
  language?: string;
  tcgMarket?: number | null;
  tcgLow?: number | null;
  tcgHigh?: number | null;
  activeListings?: number | null;
  manapoolLow?: number | null;
  observedAt?: string;
}): TcgTrackingPriceSnapshotRow | null {
  if (!input.tcgplayerProductId) return null;
  return {
    category_id: input.categoryId ?? SYNC_MAGIC_CATEGORY_ID,
    tcgplayer_product_id: input.tcgplayerProductId,
    tcgplayer_sku_id: input.tcgplayerSkuId ?? null,
    condition: normalizeCondition(input.condition) ?? null,
    finish: normalizeFinish(input.finish) ?? null,
    language: input.language ?? null,
    tcg_market: input.tcgMarket ?? null,
    tcg_low: input.tcgLow ?? null,
    tcg_high: input.tcgHigh ?? null,
    active_listing_count: input.activeListings ?? null,
    manapool_low: input.manapoolLow ?? null,
    observed_at: input.observedAt ?? new Date().toISOString(),
  };
}

export async function advanceTcgTrackingMagicSync(
  database: TcgTrackingSyncClient,
  input: AdvanceTcgTrackingSyncInput,
): Promise<AdvanceTcgTrackingSyncResult> {
  const provider = input.client ?? createTcgTrackingClient({
    timeoutMs: 20_000,
    retries: 0,
  });
  const category = input.category ?? "magic";
  const run = await getOrCreateRun(database, input.syncType);
  if (run.status === "schema_required") return run;

  try {
    const sets = await provider.sets(category);
    const checkpoint = run.run?.checkpoint ?? {};
    const startIndex = numberValue(checkpoint.setIndex) ?? 0;
    const setLimit = input.setLimit ?? TCGTRACKING_SYNC_SET_LIMIT;
    const productLimit = input.productLimit ?? TCGTRACKING_SYNC_PRODUCT_LIMIT;
    const selectedSets = sets.slice(startIndex, startIndex + setLimit);

    let processed = 0;
    let failed = 0;
    for (const set of selectedSets) {
      if (input.syncType === "product_mappings") {
        const cards = await provider.cards(category, set.id);
        const rows = cards
          .slice(0, productLimit)
          .map((product) => mappingRowFromTcgTrackingProduct({
            ...product,
            categoryId: SYNC_MAGIC_CATEGORY_ID,
            setId: product.setId ?? set.id,
            setCode: product.setCode ?? set.abbreviation,
          }))
          .filter((row): row is TcgTrackingMappingRow => Boolean(row));
        processed += rows.length;
        await upsertRows(database, "tcgtracking_product_mappings", rows, "category_id,tcgplayer_product_id");
      } else if (input.syncType === "price_snapshots") {
        const snapshots = await provider.pricing(category, set.id);
        const rows = snapshots
          .map((snapshot) =>
            priceSnapshotRowFromTcgTracking(snapshot, SYNC_MAGIC_CATEGORY_ID),
          )
          .filter((row): row is TcgTrackingPriceSnapshotRow => Boolean(row))
          .slice(0, productLimit);
        processed += rows.length;
        await insertRows(database, "tcgtracking_price_snapshots", rows);
      }
    }

    const nextSetIndex = startIndex + selectedSets.length;
    const completed = nextSetIndex >= sets.length || selectedSets.length === 0;
    const updatedRun = await updateRun(database, run.run?.id, {
      status: completed ? "completed" : "processing",
      checkpoint: {
        setIndex: nextSetIndex,
        setCount: sets.length,
        lastSetId: selectedSets.at(-1)?.id ?? checkpoint.lastSetId ?? null,
      },
      processed: (run.run?.processed ?? 0) + processed,
      updated: run.run?.updated ?? 0,
      inserted: (run.run?.inserted ?? 0) + processed,
      failed: (run.run?.failed ?? 0) + failed,
      completed_at: completed ? new Date().toISOString() : null,
      error_summary: null,
    });

    return {
      status: completed ? "completed" : "advanced",
      run: updatedRun,
      processed,
      inserted: processed,
      updated: 0,
      failed,
      currentSet: selectedSets.at(-1)?.name ?? null,
    };
  } catch (error) {
    const message = error instanceof Error
      ? error.message
      : "TCGTracking sync failed.";
    if (run.run?.id) {
      await updateRun(database, run.run.id, {
        status: "failed",
        error_summary: message,
        failed: (run.run.failed ?? 0) + 1,
      }).catch(() => null);
    }
    return {
      status: "provider_failed",
      run: run.run,
      processed: 0,
      inserted: 0,
      updated: 0,
      failed: 1,
      message,
    };
  }
}

export function latestSyncByType(runs: TcgTrackingSyncRunRow[]) {
  return {
    mapping: runs.find((run) => run.sync_type === "product_mappings") ?? null,
    pricing: runs.find((run) => run.sync_type === "price_snapshots") ?? null,
    reconciliation: runs.find((run) => run.sync_type === "sample_reconciliation") ?? null,
  };
}

async function getOrCreateRun(
  database: TcgTrackingSyncClient,
  syncType: TcgTrackingSyncType,
): Promise<
  | { status: "ready"; run: TcgTrackingSyncRunRow }
  | { status: "schema_required"; processed: 0; inserted: 0; updated: 0; failed: 0; message: string }
> {
  const existing = await database
    .from("tcgtracking_sync_runs")
    .select("id,category_id,sync_type,status,checkpoint,processed,inserted,updated,failed,error_summary,started_at,completed_at,updated_at")
    .eq("category_id", SYNC_MAGIC_CATEGORY_ID)
    .eq("sync_type", syncType)
    .in("status", ["queued", "processing", "failed", "paused"])
    .order("started_at", { ascending: false })
    .limit(1);

  if (existing.error) return schemaRequired(existing.error.message);
  const current = Array.isArray(existing.data)
    ? existing.data[0] as TcgTrackingSyncRunRow | undefined
    : undefined;
  if (current) {
    if (current.status === "failed" || current.status === "paused") {
      const resumed = await updateRun(database, current.id, {
        status: "processing",
        error_summary: null,
      });
      return { status: "ready", run: resumed ?? current };
    }
    return { status: "ready", run: current };
  }

  const created = await database
    .from("tcgtracking_sync_runs")
    .insert({
      category_id: SYNC_MAGIC_CATEGORY_ID,
      sync_type: syncType,
      status: "processing",
      checkpoint: {},
    })
    .select("id,category_id,sync_type,status,checkpoint,processed,inserted,updated,failed,error_summary,started_at,completed_at,updated_at")
    .single();
  if (created.error) return schemaRequired(created.error.message);
  return { status: "ready", run: created.data as TcgTrackingSyncRunRow };
}

async function upsertRows(
  database: TcgTrackingSyncClient,
  table: string,
  rows: unknown[],
  onConflict: string,
) {
  if (!rows.length) return;
  const result = await database.from(table).upsert(rows, { onConflict });
  if (result.error) {
    throw new Error(result.error.message ?? `Could not upsert ${table}.`);
  }
}

async function insertRows(
  database: TcgTrackingSyncClient,
  table: string,
  rows: unknown[],
) {
  if (!rows.length) return;
  const result = await database.from(table).insert(rows);
  if (result.error) {
    throw new Error(result.error.message ?? `Could not insert ${table}.`);
  }
}

async function updateRun(
  database: TcgTrackingSyncClient,
  id: string | undefined,
  values: Partial<TcgTrackingSyncRunRow>,
) {
  if (!id) return null;
  const updated = await database
    .from("tcgtracking_sync_runs")
    .update(values)
    .eq("id", id)
    .select("id,category_id,sync_type,status,checkpoint,processed,inserted,updated,failed,error_summary,started_at,completed_at,updated_at")
    .single();
  if (updated.error) {
    throw new Error(updated.error.message ?? "Could not update TCGTracking sync run.");
  }
  return updated.data as TcgTrackingSyncRunRow;
}

function schemaRequired(message?: string) {
  return {
    status: "schema_required" as const,
    processed: 0 as const,
    inserted: 0 as const,
    updated: 0 as const,
    failed: 0 as const,
    message:
      message ??
      "TCGTracking enrichment cache tables are not installed. Review and apply the proposal migration before running sync.",
  };
}

function uuidOrNull(value: string | undefined) {
  if (!value) return null;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
    ? value
    : null;
}

function numberValue(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value)
    ? value
    : undefined;
}
