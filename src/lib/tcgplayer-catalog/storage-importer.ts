import {
  createTcgplayerCatalogImportRun,
  processTcgplayerMagicCatalogCsv,
  updateTcgplayerCatalogImportRun,
  type SupabaseCatalogClient,
  type TcgplayerCatalogImportSummary,
} from "./importer.ts";

export const TCGPLAYER_MAGIC_STORAGE_BUCKET = "catalog-imports";
export const TCGPLAYER_MAGIC_STORAGE_PREFIX = "tcgplayer/magic/2026-08-10/";
export const TCGPLAYER_MAGIC_STORAGE_PARTS = [
  "tcgplayer/magic/2026-08-10/part-001.csv",
  "tcgplayer/magic/2026-08-10/part-002.csv",
  "tcgplayer/magic/2026-08-10/part-003.csv",
] as const;

export type TcgplayerCatalogStoragePart = {
  path: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  rejectedRows: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type TcgplayerCatalogStorageImportResult = {
  importRunId: string;
  logicalImportKey: string;
  bucket: string;
  prefix: string | null;
  parts: TcgplayerCatalogStoragePart[];
  summary: TcgplayerCatalogImportSummary;
  status: "processing" | "completed" | "failed";
  skippedCompletedImport: boolean;
};

type SupabaseStorageCatalogClient = SupabaseCatalogClient & {
  storage: {
    from: (bucket: string) => {
      list: (prefix: string) => PromiseLike<{
        data: Array<{ name: string; id?: string | null }> | null;
        error: { message?: string } | null;
      }>;
      download: (path: string) => PromiseLike<{
        data: Blob | null;
        error: { message?: string } | null;
      }>;
    };
  };
};

type ImportRunRow = {
  id: string;
  status: "processing" | "completed" | "failed" | "validated";
  filename: string | null;
  total_rows: number | string | null;
  processed_rows: number | string | null;
  inserted_rows: number | string | null;
  updated_rows: number | string | null;
  rejected_rows: number | string | null;
  error_summary: unknown;
};

type StorageImportMetadata = {
  kind: "tcgplayer-storage-multipart";
  bucket: string;
  prefix: string | null;
  parts: TcgplayerCatalogStoragePart[];
  errors: TcgplayerCatalogImportSummary["errors"];
};

export async function resolveTcgplayerMagicStorageParts(
  client: SupabaseStorageCatalogClient,
  options: {
    bucket?: string;
    prefix?: string | null;
    paths?: string[];
  } = {},
) {
  const bucket = options.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET;
  const explicitPaths = normalizeStoragePaths(options.paths ?? []);
  if (explicitPaths.length > 0) return explicitPaths;

  const prefix = normalizeStoragePrefix(options.prefix ?? TCGPLAYER_MAGIC_STORAGE_PREFIX);
  const { data, error } = await client.storage.from(bucket).list(prefix);
  if (error) throw new Error(error.message ?? "Could not list TCGplayer catalog storage folder.");

  const paths = (data ?? [])
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((name) => `${prefix}${name}`);

  if (paths.length === 0) {
    throw new Error(`No CSV parts found in ${bucket}/${prefix}.`);
  }

  return paths;
}

export async function importTcgplayerMagicCatalogFromStorage(
  client: SupabaseStorageCatalogClient,
  options: {
    actorId?: string | null;
    bucket?: string;
    prefix?: string | null;
    paths?: string[];
    importedAt?: string;
    batchSize?: number;
    retryFailed?: boolean;
  } = {},
): Promise<TcgplayerCatalogStorageImportResult> {
  const bucket = options.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET;
  const prefix = options.prefix === undefined ? TCGPLAYER_MAGIC_STORAGE_PREFIX : normalizeOptionalPrefix(options.prefix);
  const paths = await resolveTcgplayerMagicStorageParts(client, { bucket, prefix, paths: options.paths });
  const logicalImportKey = storageImportKey(bucket, prefix, paths);
  const existing = await findLatestStorageImportRun(client, logicalImportKey);

  if (existing?.status === "completed") {
    return {
      importRunId: existing.id,
      logicalImportKey,
      bucket,
      prefix,
      parts: metadataFromImportRun(existing, bucket, prefix, paths).parts,
      summary: summaryFromImportRun(existing),
      status: "completed",
      skippedCompletedImport: true,
    };
  }

  if (existing?.status === "processing") {
    throw new Error("A TCGplayer storage catalog import is already processing.");
  }

  const importRunId = existing?.id ?? await createTcgplayerCatalogImportRun(client, {
    actor_id: options.actorId ?? null,
    filename: logicalImportKey,
    status: "processing",
    error_summary: storageMetadata(bucket, prefix, paths.map((path) => emptyPart(path)), []),
  });
  const metadata = existing ? metadataFromImportRun(existing, bucket, prefix, paths) : storageMetadata(bucket, prefix, paths.map((path) => emptyPart(path)), []);
  const summary = aggregateCompletedParts(metadata.parts);

  await persistStorageImport(client, importRunId, summary, {
    ...metadata,
    parts: metadata.parts.map((part) => part.status === "failed" ? { ...part, status: "pending" as const, error: undefined } : part),
  }, "processing");

  for (const path of paths) {
    let partIndex = metadata.parts.findIndex((part) => part.path === path);
    if (partIndex < 0) {
      metadata.parts.push(emptyPart(path));
      partIndex = metadata.parts.length - 1;
    }
    const currentPart = metadata.parts[partIndex];
    if (currentPart.status === "completed") continue;

    metadata.parts[partIndex] = { ...currentPart, status: "processing", error: undefined, startedAt: new Date().toISOString() };
    await persistStorageImport(client, importRunId, summary, metadata, "processing");

    const before = cloneSummary(summary);
    try {
      const { data, error } = await client.storage.from(bucket).download(path);
      if (error) throw new Error(error.message ?? `Could not download ${path}.`);
      if (!data) throw new Error(`Storage object ${path} did not return a readable CSV.`);

      await processTcgplayerMagicCatalogCsv(client, data.stream(), summary, {
        importedAt: options.importedAt,
        batchSize: options.batchSize,
      });

      metadata.parts[partIndex] = {
        path,
        status: "completed",
        ...summaryDelta(before, summary),
        startedAt: metadata.parts[partIndex]?.startedAt,
        completedAt: new Date().toISOString(),
      };
      await persistStorageImport(client, importRunId, summary, metadata, "processing");
    } catch (error) {
      metadata.parts[partIndex] = {
        ...metadata.parts[partIndex],
        status: "failed",
        ...summaryDelta(before, summary),
        error: error instanceof Error ? error.message : `Could not import ${path}.`,
        completedAt: new Date().toISOString(),
      };
      await persistStorageImport(client, importRunId, summary, metadata, "failed");
      throw error;
    }
  }

  await persistStorageImport(client, importRunId, summary, metadata, "completed");

  return {
    importRunId,
    logicalImportKey,
    bucket,
    prefix,
    parts: metadata.parts,
    summary,
    status: "completed",
    skippedCompletedImport: false,
  };
}

function storageImportKey(bucket: string, prefix: string | null, paths: string[]) {
  return prefix ? `storage://${bucket}/${prefix}` : `storage://${bucket}/${paths.join("|")}`;
}

function normalizeStoragePrefix(prefix: string) {
  const cleaned = prefix.trim().replace(/^\/+/, "");
  return cleaned.endsWith("/") ? cleaned : `${cleaned}/`;
}

function normalizeOptionalPrefix(prefix: string | null) {
  if (!prefix) return null;
  return normalizeStoragePrefix(prefix);
}

function normalizeStoragePaths(paths: string[]) {
  return paths
    .map((path) => path.trim().replace(/^\/+/, ""))
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function emptyPart(path: string): TcgplayerCatalogStoragePart {
  return {
    path,
    status: "pending",
    totalRows: 0,
    processedRows: 0,
    insertedRows: 0,
    updatedRows: 0,
    rejectedRows: 0,
  };
}

function storageMetadata(
  bucket: string,
  prefix: string | null,
  parts: TcgplayerCatalogStoragePart[],
  errors: TcgplayerCatalogImportSummary["errors"],
): StorageImportMetadata {
  return {
    kind: "tcgplayer-storage-multipart",
    bucket,
    prefix,
    parts,
    errors,
  };
}

function metadataFromImportRun(
  row: ImportRunRow,
  bucket: string,
  prefix: string | null,
  paths: string[],
) {
  if (
    row.error_summary &&
    typeof row.error_summary === "object" &&
    "kind" in row.error_summary &&
    (row.error_summary as { kind?: unknown }).kind === "tcgplayer-storage-multipart"
  ) {
    const metadata = row.error_summary as StorageImportMetadata;
    const byPath = new Map(metadata.parts.map((part) => [part.path, part]));
    return storageMetadata(bucket, prefix, paths.map((path) => byPath.get(path) ?? emptyPart(path)), metadata.errors ?? []);
  }

  return storageMetadata(bucket, prefix, paths.map((path) => emptyPart(path)), []);
}

function summaryFromImportRun(row: ImportRunRow): TcgplayerCatalogImportSummary {
  return {
    totalRows: Number(row.total_rows ?? 0),
    processedRows: Number(row.processed_rows ?? 0),
    insertedRows: Number(row.inserted_rows ?? 0),
    updatedRows: Number(row.updated_rows ?? 0),
    rejectedRows: Number(row.rejected_rows ?? 0),
    errors: Array.isArray(row.error_summary) ? row.error_summary as TcgplayerCatalogImportSummary["errors"] : [],
  };
}

function aggregateCompletedParts(parts: TcgplayerCatalogStoragePart[]): TcgplayerCatalogImportSummary {
  return parts
    .filter((part) => part.status === "completed")
    .reduce<TcgplayerCatalogImportSummary>((summary, part) => ({
      totalRows: summary.totalRows + part.totalRows,
      processedRows: summary.processedRows + part.processedRows,
      insertedRows: summary.insertedRows + part.insertedRows,
      updatedRows: summary.updatedRows + part.updatedRows,
      rejectedRows: summary.rejectedRows + part.rejectedRows,
      errors: summary.errors,
    }), { totalRows: 0, processedRows: 0, insertedRows: 0, updatedRows: 0, rejectedRows: 0, errors: [] });
}

function cloneSummary(summary: TcgplayerCatalogImportSummary): TcgplayerCatalogImportSummary {
  return {
    totalRows: summary.totalRows,
    processedRows: summary.processedRows,
    insertedRows: summary.insertedRows,
    updatedRows: summary.updatedRows,
    rejectedRows: summary.rejectedRows,
    errors: [...summary.errors],
  };
}

function summaryDelta(before: TcgplayerCatalogImportSummary, after: TcgplayerCatalogImportSummary) {
  return {
    totalRows: after.totalRows - before.totalRows,
    processedRows: after.processedRows - before.processedRows,
    insertedRows: after.insertedRows - before.insertedRows,
    updatedRows: after.updatedRows - before.updatedRows,
    rejectedRows: after.rejectedRows - before.rejectedRows,
  };
}

async function persistStorageImport(
  client: SupabaseCatalogClient,
  id: string,
  summary: TcgplayerCatalogImportSummary,
  metadata: StorageImportMetadata,
  status: "processing" | "completed" | "failed",
) {
  await updateTcgplayerCatalogImportRun(client, id, {
    status,
    total_rows: summary.totalRows,
    processed_rows: summary.processedRows,
    inserted_rows: summary.insertedRows,
    updated_rows: summary.updatedRows,
    rejected_rows: summary.rejectedRows,
    error_summary: { ...metadata, errors: summary.errors },
    completed_at: status === "processing" ? null : new Date().toISOString(),
  });
}

async function findLatestStorageImportRun(
  client: SupabaseCatalogClient,
  logicalImportKey: string,
): Promise<ImportRunRow | null> {
  const query = (client.from("tcgplayer_magic_catalog_imports") as unknown as {
    select: (columns: string) => {
      eq: (column: string, value: string) => {
        order: (column: string, options: { ascending: boolean }) => {
          limit: (count: number) => PromiseLike<{
            data: ImportRunRow[] | null;
            error: { message?: string } | null;
          }>;
        };
      };
    };
  }).select("*").eq("filename", logicalImportKey).order("started_at", { ascending: false }).limit(1);

  const { data, error } = await query;
  if (error) throw new Error(error.message ?? "Could not inspect existing TCGplayer catalog import.");
  return data?.[0] ?? null;
}
