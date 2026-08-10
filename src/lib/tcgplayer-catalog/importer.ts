import {
  mapTcgplayerMagicCsvRow,
  parseTcgplayerMagicCsv,
  type TcgplayerMagicCatalogRecord,
} from "./csv.ts";

export type TcgplayerCatalogImportError = {
  row: number;
  error: string;
};

export type TcgplayerCatalogImportSummary = {
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  rejectedRows: number;
  errors: TcgplayerCatalogImportError[];
};

export type SupabaseCatalogClient = {
  from: (table: string) => {
    select: (columns: string) => CatalogQuery;
    upsert: (
      rows: TcgplayerMagicCatalogRecord[],
      options: { onConflict: string },
    ) => CatalogMutation;
    insert: (row: Record<string, unknown>) => CatalogMutation;
    update: (row: Record<string, unknown>) => {
      eq: (column: string, value: string) => CatalogMutation;
    };
  };
};

type CatalogQuery = PromiseLike<{
  data: Array<Record<string, unknown>> | null;
  error: { message?: string } | null;
}> & {
  in: (column: string, values: number[]) => CatalogQuery;
  order: (column: string, options?: { ascending?: boolean }) => CatalogQuery;
  limit: (count: number) => CatalogQuery;
};

type CatalogMutation = PromiseLike<{
  data?: unknown;
  error: { message?: string } | null;
}>;

export const TCGPLAYER_CATALOG_IMPORT_BATCH_SIZE = 1000;
const MAX_REPORTED_ERRORS = 50;

export async function importTcgplayerMagicCatalogCsv(
  client: SupabaseCatalogClient,
  source: string | ReadableStream<Uint8Array>,
  options: {
    actorId?: string | null;
    filename?: string | null;
    validateOnly?: boolean;
    importedAt?: string;
    batchSize?: number;
  } = {},
): Promise<TcgplayerCatalogImportSummary> {
  const summary: TcgplayerCatalogImportSummary = {
    totalRows: 0,
    processedRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    rejectedRows: 0,
    errors: [],
  };
  const importedAt = options.importedAt ?? new Date().toISOString();
  const batchSize = options.batchSize ?? TCGPLAYER_CATALOG_IMPORT_BATCH_SIZE;
  let batch: TcgplayerMagicCatalogRecord[] = [];
  let importRunId: string | null = null;

  if (!options.validateOnly) {
    importRunId = await createImportRun(client, {
      actor_id: options.actorId ?? null,
      filename: options.filename ?? null,
      status: "processing",
    });
  }

  try {
    let rowNumber = 1;
    for await (const row of parseTcgplayerMagicCsv(source)) {
      rowNumber += 1;
      summary.totalRows += 1;
      const mapped = mapTcgplayerMagicCsvRow(row, { rowNumber, importedAt });
      if (!mapped.ok) {
        summary.rejectedRows += 1;
        pushError(summary, mapped);
        continue;
      }

      summary.processedRows += 1;
      batch.push(mapped.record);
      if (batch.length >= batchSize) {
        await flushBatch(client, batch, summary, Boolean(options.validateOnly));
        batch = [];
      }
    }

    if (batch.length > 0) {
      await flushBatch(client, batch, summary, Boolean(options.validateOnly));
    }

    if (importRunId) await finishImportRun(client, importRunId, summary, "completed");
    return summary;
  } catch (error) {
    if (importRunId) {
      pushError(summary, {
        row: summary.totalRows + 1,
        error: error instanceof Error ? error.message : "TCGplayer catalog import failed.",
      });
      await finishImportRun(client, importRunId, summary, "failed");
    }
    throw error;
  }
}

async function flushBatch(
  client: SupabaseCatalogClient,
  rows: TcgplayerMagicCatalogRecord[],
  summary: TcgplayerCatalogImportSummary,
  validateOnly: boolean,
) {
  const ids = rows.map((row) => row.tcgplayer_id);
  const existing = validateOnly ? new Set<number>() : await existingTcgplayerIds(client, ids);
  if (!validateOnly) {
    const { error } = await client
      .from("tcgplayer_magic_catalog")
      .upsert(rows, { onConflict: "tcgplayer_id" });
    if (error) throw new Error(error.message ?? "Could not upsert TCGplayer catalog rows.");
  }

  for (const id of ids) {
    if (existing.has(id)) summary.updatedRows += 1;
    else summary.insertedRows += 1;
  }
}

async function existingTcgplayerIds(
  client: SupabaseCatalogClient,
  ids: number[],
) {
  const { data, error } = await client
    .from("tcgplayer_magic_catalog")
    .select("tcgplayer_id")
    .in("tcgplayer_id", ids);
  if (error) throw new Error(error.message ?? "Could not check existing TCGplayer catalog IDs.");
  return new Set((data ?? []).map((row) => Number(row.tcgplayer_id)));
}

async function createImportRun(
  client: SupabaseCatalogClient,
  row: Record<string, unknown>,
) {
  const id = crypto.randomUUID();
  const { data, error } = await client
    .from("tcgplayer_magic_catalog_imports")
    .insert({ id, ...row });
  if (error) throw new Error(error.message ?? "Could not create TCGplayer catalog import run.");
  void data;
  return id;
}

async function finishImportRun(
  client: SupabaseCatalogClient,
  id: string,
  summary: TcgplayerCatalogImportSummary,
  status: "completed" | "failed",
) {
  const { error } = await client
    .from("tcgplayer_magic_catalog_imports")
    .update({
      status,
      total_rows: summary.totalRows,
      processed_rows: summary.processedRows,
      inserted_rows: summary.insertedRows,
      updated_rows: summary.updatedRows,
      rejected_rows: summary.rejectedRows,
      error_summary: summary.errors,
      completed_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(error.message ?? "Could not finish TCGplayer catalog import run.");
}

function pushError(
  summary: TcgplayerCatalogImportSummary,
  error: TcgplayerCatalogImportError,
) {
  if (summary.errors.length < MAX_REPORTED_ERRORS) summary.errors.push(error);
}
