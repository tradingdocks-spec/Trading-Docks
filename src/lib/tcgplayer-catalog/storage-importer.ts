import {
  TCGPLAYER_MAGIC_CSV_HEADERS,
  mapTcgplayerMagicCsvRow,
  validateTcgplayerMagicHeaders,
  type TcgplayerMagicCatalogRecord,
  type TcgplayerMagicCsvHeader,
} from "./csv.ts";
import {
  createTcgplayerCatalogImportRun,
  updateTcgplayerCatalogImportRun,
  type SupabaseCatalogClient,
  type TcgplayerCatalogImportError,
  type TcgplayerCatalogImportSummary,
} from "./importer.ts";

export const TCGPLAYER_MAGIC_STORAGE_BUCKET = "catalog-imports";
export const TCGPLAYER_MAGIC_STORAGE_PREFIX = "";
export const TCGPLAYER_MAGIC_STORAGE_PARTS = [
  "part-001.csv",
  "part-002.csv",
  "part-003.csv",
] as const;

export const TCGPLAYER_STORAGE_IMPORT_BATCH_ROWS = 10_000;
export const TCGPLAYER_STORAGE_IMPORT_BATCH_BYTES = 4 * 1024 * 1024;
export const TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS = 1000;

export type TcgplayerCatalogStoragePart = {
  path: string;
  status: "pending" | "processing" | "completed" | "failed";
  byteOffset: number;
  totalBytes: number | null;
  headerValidated: boolean;
  headers: string[] | null;
  totalRows: number;
  processedRows: number;
  insertedRows: number;
  updatedRows: number;
  rejectedRows: number;
  error?: string;
  startedAt?: string;
  completedAt?: string;
};

export type TcgplayerStoragePartVerification = {
  path: string;
  exists: boolean;
  size: number | null;
  contentType: string | null;
  error?: string;
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
  currentPartIndex: number;
  currentPartPath: string | null;
  batch: {
    attempted: boolean;
    completedRows: number;
    completedBytes: number;
    partCompleted: boolean;
    importCompleted: boolean;
  };
};

export type TcgplayerStorageDownloadRange = {
  bytes: Uint8Array;
  start: number;
  end: number;
  totalBytes: number;
};

export type TcgplayerCatalogImportStage =
  | "payload-parse"
  | "authorization"
  | "verify-parts"
  | "job-lookup"
  | "job-create"
  | "range-fetch"
  | "csv-parse"
  | "normalization"
  | "upsert"
  | "checkpoint-write"
  | "job-update";

export type TcgplayerCatalogImportStageContext = {
  action?: string;
  stage: TcgplayerCatalogImportStage;
  bucket?: string;
  objectPath?: string;
  partIndex?: number;
  byteOffset?: number;
  rowLimit?: number;
  byteLimit?: number;
  rangeHeader?: string;
  status?: number;
  statusText?: string;
  responseBody?: string;
};

export class TcgplayerCatalogImportStageError extends Error {
  context: TcgplayerCatalogImportStageContext;
  originalError: unknown;
  statusCode: number;

  constructor(
    message: string,
    context: TcgplayerCatalogImportStageContext,
    originalError: unknown,
    statusCode = 500,
  ) {
    super(message.trim() || "Catalog import batch failed");
    this.name = "TcgplayerCatalogImportStageError";
    this.context = context;
    this.originalError = originalError;
    this.statusCode = statusCode;
  }
}

type SupabaseStorageCatalogClient = SupabaseCatalogClient & {
  storage: {
    from: (bucket: string) => {
      list: (prefix: string) => PromiseLike<{
        data: Array<{
          name: string;
          id?: string | null;
          metadata?: {
            size?: number | string | null;
            mimetype?: string | null;
            contentType?: string | null;
          } | null;
        }> | null;
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
  errors: TcgplayerCatalogImportError[];
};

type StorageImportOptions = {
  actorId?: string | null;
  bucket?: string;
  prefix?: string | null;
  paths?: string[];
  importedAt?: string;
  batchSize?: number;
  byteLimit?: number;
  downloadRange?: (bucket: string, path: string, startByte: number, byteLength: number) => Promise<TcgplayerStorageDownloadRange>;
};

const MAX_REPORTED_ERRORS = 50;

export async function resolveTcgplayerMagicStorageParts(
  client: SupabaseStorageCatalogClient,
  options: {
    bucket?: string;
    prefix?: string | null;
    paths?: string[];
  } = {},
) {
  const bucket = options.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET;
  const prefix = normalizeOptionalPrefix(options.prefix ?? TCGPLAYER_MAGIC_STORAGE_PREFIX);
  const explicitPaths = normalizeStoragePaths(options.paths ?? [], prefix);
  if (explicitPaths.length > 0) return explicitPaths;

  const listPrefix = prefix ?? "";
  const { data, error } = await client.storage.from(bucket).list(listPrefix);
  if (error) throw new Error(error.message ?? "Could not list TCGplayer catalog storage folder.");

  const paths = (data ?? [])
    .map((entry) => entry.name)
    .filter((name) => name.toLowerCase().endsWith(".csv"))
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }))
    .map((name) => `${listPrefix}${name}`);

  if (paths.length === 0) {
    throw new Error(`No CSV parts found in ${bucket}/${listPrefix}.`);
  }

  return paths;
}

export async function verifyTcgplayerMagicStorageParts(
  client: SupabaseStorageCatalogClient,
  options: {
    bucket?: string;
    prefix?: string | null;
    paths?: string[];
  } = {},
): Promise<TcgplayerStoragePartVerification[]> {
  const bucket = options.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET;
  const prefix = normalizeOptionalPrefix(options.prefix ?? TCGPLAYER_MAGIC_STORAGE_PREFIX);
  const paths = normalizeStoragePaths(options.paths ?? [...TCGPLAYER_MAGIC_STORAGE_PARTS], prefix);

  return Promise.all(paths.map(async (path) => verifyStoragePath(client, bucket, path)));
}

export async function startTcgplayerMagicStorageImport(
  client: SupabaseStorageCatalogClient,
  options: StorageImportOptions = {},
): Promise<TcgplayerCatalogStorageImportResult> {
  const bucket = options.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET;
  const prefix = options.prefix === undefined ? TCGPLAYER_MAGIC_STORAGE_PREFIX : normalizeOptionalPrefix(options.prefix);
  const paths = await runImportStage("verify-parts", { action: "storage-start", bucket }, () =>
    resolveTcgplayerMagicStorageParts(client, { bucket, prefix, paths: options.paths }),
  );
  const logicalImportKey = storageImportKey(bucket, prefix, paths);
  const existingRow = await runImportStage("job-lookup", { action: "storage-start", bucket }, () =>
    findLatestStorageImportRun(client, logicalImportKey),
  );
  const existing = existingRow && isInvalidCompletedStorageRun(existingRow, bucket, prefix, paths) ? null : existingRow;

  if (existing?.status === "completed" && !isInvalidCompletedStorageRun(existing, bucket, prefix, paths)) {
    return resultFromImportRun(existing, bucket, prefix, paths, true);
  }
  if (existing?.status === "processing") {
    return resultFromImportRun(existing, bucket, prefix, paths, false);
  }

  const metadata = storageMetadata(bucket, prefix, paths.map((path) => emptyPart(path)), []);
  const importRunId = await runImportStage("job-create", { action: "storage-start", bucket }, () =>
    createTcgplayerCatalogImportRun(client, {
      actor_id: options.actorId ?? null,
      filename: logicalImportKey,
      status: "processing",
      error_summary: metadata,
    }),
  );

  const row: ImportRunRow = {
    id: importRunId,
    status: "processing",
    filename: logicalImportKey,
    total_rows: 0,
    processed_rows: 0,
    inserted_rows: 0,
    updated_rows: 0,
    rejected_rows: 0,
    error_summary: metadata,
  };
  return resultFromImportRun(row, bucket, prefix, paths, false);
}

export async function advanceTcgplayerMagicStorageImport(
  client: SupabaseStorageCatalogClient,
  options: StorageImportOptions = {},
): Promise<TcgplayerCatalogStorageImportResult> {
  const bucket = options.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET;
  const prefix = options.prefix === undefined ? TCGPLAYER_MAGIC_STORAGE_PREFIX : normalizeOptionalPrefix(options.prefix);
  const paths = await runImportStage("verify-parts", { action: "storage-advance", bucket }, () =>
    resolveTcgplayerMagicStorageParts(client, { bucket, prefix, paths: options.paths }),
  );
  const logicalImportKey = storageImportKey(bucket, prefix, paths);
  const existingRow = await runImportStage("job-lookup", { action: "storage-advance", bucket }, () =>
    findLatestStorageImportRun(client, logicalImportKey),
  );
  const existing = existingRow && isInvalidCompletedStorageRun(existingRow, bucket, prefix, paths) ? null : existingRow;
  const active = existing ?? await runImportStage("job-create", { action: "storage-advance", bucket }, () =>
    createStartedRun(client, options, bucket, prefix, paths, logicalImportKey),
  );

  if (active.status === "completed" && !isInvalidCompletedStorageRun(active, bucket, prefix, paths)) {
    return resultFromImportRun(active, bucket, prefix, paths, true);
  }

  const metadata = metadataFromImportRun(active, bucket, prefix, paths);
  const summary = summaryFromImportRun(active, metadata);
  const partIndex = metadata.parts.findIndex((part) => part.status !== "completed");
  if (partIndex < 0) {
    if (!storageImportCanComplete(summary, metadata.parts)) {
      await runImportStage("job-update", { action: "storage-advance", bucket }, () =>
        persistStorageImport(client, active.id, summary, metadata, "failed"),
      );
      throw new Error("TCGplayer storage import cannot complete with zero processed rows or incomplete parts.");
    }
    await runImportStage("job-update", { action: "storage-advance", bucket }, () =>
      persistStorageImport(client, active.id, summary, metadata, "completed"),
    );
    return resultFromImportRun({ ...active, status: "completed", error_summary: metadata }, bucket, prefix, paths, false);
  }

  const part = metadata.parts[partIndex];
  const beforeSummary = cloneSummary(summary);
  const beforePart = { ...part };
  const stageContext = {
    action: "storage-advance",
    bucket,
    objectPath: part.path,
    partIndex,
    byteOffset: part.byteOffset,
    rowLimit: options.batchSize ?? TCGPLAYER_STORAGE_IMPORT_BATCH_ROWS,
    byteLimit: options.byteLimit ?? TCGPLAYER_STORAGE_IMPORT_BATCH_BYTES,
  };

  try {
    console.info("TCG catalog advance started", stageContext);
    const range = await runImportStage("range-fetch", stageContext, () =>
      (options.downloadRange ?? downloadSupabaseStorageRange)(
        bucket,
        part.path,
        part.byteOffset,
        options.byteLimit ?? TCGPLAYER_STORAGE_IMPORT_BATCH_BYTES,
      ),
    );
    console.info("Storage range fetch succeeded", { ...stageContext, bytes: range.bytes.length, totalBytes: range.totalBytes });
    const parsed = runImportStageSync("csv-parse", stageContext, () =>
      parseCatalogRowsFromByteRange(range.bytes, {
        absoluteStartByte: range.start,
        totalBytes: range.totalBytes,
        headers: part.headers,
        validateHeader: !part.headerValidated,
        maxRows: options.batchSize ?? TCGPLAYER_STORAGE_IMPORT_BATCH_ROWS,
      }),
    );
    console.info("CSV chunk parsed", { ...stageContext, records: parsed.records.length, rejected: parsed.rejected.length });

    part.status = parsed.partCompleted ? "completed" : "processing";
    part.byteOffset = parsed.nextByteOffset;
    part.totalBytes = range.totalBytes;
    part.headerValidated = true;
    part.headers = parsed.headers;
    part.startedAt = part.startedAt ?? new Date().toISOString();
    part.completedAt = parsed.partCompleted ? new Date().toISOString() : undefined;
    part.error = undefined;

    await runImportStage("upsert", stageContext, () => upsertCatalogRecords(client, parsed.records, summary));
    console.info("Catalog upsert succeeded", { ...stageContext, records: parsed.records.length });
    applyRejectedRows(summary, parsed.rejected);

    const delta = summaryDelta(beforeSummary, summary);
    part.totalRows = beforePart.totalRows + delta.totalRows;
    part.processedRows = beforePart.processedRows + delta.processedRows;
    part.insertedRows = beforePart.insertedRows + delta.insertedRows;
    part.updatedRows = beforePart.updatedRows + delta.updatedRows;
    part.rejectedRows = beforePart.rejectedRows + delta.rejectedRows;

    const completed = storageImportCanComplete(summary, metadata.parts);
    await runImportStage("checkpoint-write", stageContext, () =>
      persistStorageImport(client, active.id, summary, metadata, completed ? "completed" : "processing"),
    );
    console.info("Checkpoint persisted", { ...stageContext, status: completed ? "completed" : "processing" });

    return {
      importRunId: active.id,
      logicalImportKey,
      bucket,
      prefix,
      parts: metadata.parts,
      summary,
      status: completed ? "completed" : "processing",
      skippedCompletedImport: false,
      currentPartIndex: partIndex,
      currentPartPath: part.path,
      batch: {
        attempted: true,
        completedRows: parsed.records.length + parsed.rejected.length,
        completedBytes: parsed.nextByteOffset - range.start,
        partCompleted: parsed.partCompleted,
        importCompleted: completed,
      },
    };
  } catch (error) {
    part.status = "failed";
    const stageError = error instanceof TcgplayerCatalogImportStageError
      ? error
      : new TcgplayerCatalogImportStageError(
        errorMessage(error, "Could not advance TCGplayer storage import."),
        { ...stageContext, stage: "job-update" },
        error,
      );
    part.error = stageError.message;
    part.completedAt = new Date().toISOString();
    await runImportStage("job-update", stageContext, () => persistStorageImport(client, active.id, summary, metadata, "failed"));
    throw stageError;
  }
}

export const importTcgplayerMagicCatalogFromStorage = advanceTcgplayerMagicStorageImport;

function parseCatalogRowsFromByteRange(
  bytes: Uint8Array,
  options: {
    absoluteStartByte: number;
    totalBytes: number;
    headers: string[] | null;
    validateHeader: boolean;
    maxRows: number;
  },
) {
  const rows = parseCsvRowsFromBytes(bytes, options.absoluteStartByte, options.totalBytes);
  let headers = options.headers;
  let rowStartIndex = 0;
  if (options.validateHeader) {
    const headerRow = rows[0];
    if (!headerRow) throw new Error("The CSV is empty or the byte range is too small to validate the header.");
    headers = headerRow.row.map((header) => header.trim());
    const validation = validateTcgplayerMagicHeaders(headers);
    if (!validation.ok) {
      throw new Error(`Missing required TCGplayer CSV headers: ${validation.missing.join(", ")}`);
    }
    rowStartIndex = 1;
  }
  if (!headers) throw new Error("Cannot resume TCGplayer CSV import before the file header is validated.");

  const records: TcgplayerMagicCatalogRecord[] = [];
  const rejected: TcgplayerCatalogImportError[] = [];
  let nextByteOffset = options.absoluteStartByte;
  let exhaustedRows = true;

  for (let index = rowStartIndex; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row.row.some((cell) => cell.trim())) {
      nextByteOffset = row.endByteOffset;
      continue;
    }
    if (records.length + rejected.length >= options.maxRows) {
      exhaustedRows = false;
      break;
    }

    const record = Object.fromEntries(
      TCGPLAYER_MAGIC_CSV_HEADERS.map((header) => [
        header,
        row.row[headers.indexOf(header)]?.trim() ?? "",
      ]),
    ) as Record<TcgplayerMagicCsvHeader, string>;
    const mapped = mapTcgplayerMagicCsvRow(record, { rowNumber: 1 + records.length + rejected.length });
    if (mapped.ok) records.push(mapped.record);
    else rejected.push(mapped);
    nextByteOffset = row.endByteOffset;
  }

  const partCompleted = nextByteOffset >= options.totalBytes && exhaustedRows;
  if (nextByteOffset === options.absoluteStartByte && bytes.length > 0) {
    throw new Error("The CSV row exceeds the safe byte range. Increase the catalog import byte batch size.");
  }

  return {
    headers,
    records,
    rejected,
    nextByteOffset,
    partCompleted,
  };
}

function parseCsvRowsFromBytes(bytes: Uint8Array, absoluteStartByte: number, totalBytes: number) {
  const decoder = new TextDecoder();
  const rows: Array<{ row: string[]; endByteOffset: number }> = [];
  let row: string[] = [];
  let cell: number[] = [];
  let quoted = false;

  function pushCell() {
    row.push(decoder.decode(new Uint8Array(cell)));
    cell = [];
  }

  function pushRow(endByteIndex: number) {
    rows.push({
      row,
      endByteOffset: absoluteStartByte + endByteIndex + 1,
    });
    row = [];
  }

  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index];
    if (byte === 34 && quoted && bytes[index + 1] === 34) {
      cell.push(34);
      index += 1;
      continue;
    }
    if (byte === 34) {
      quoted = !quoted;
      continue;
    }
    if (byte === 44 && !quoted) {
      pushCell();
      continue;
    }
    if ((byte === 10 || byte === 13) && !quoted) {
      pushCell();
      if (byte === 13 && bytes[index + 1] === 10) index += 1;
      pushRow(index);
      continue;
    }
    cell.push(byte);
  }

  if (absoluteStartByte + bytes.length >= totalBytes && (cell.length > 0 || row.length > 0)) {
    pushCell();
    rows.push({
      row,
      endByteOffset: totalBytes,
    });
  }

  return rows;
}

async function upsertCatalogRecords(
  client: SupabaseCatalogClient,
  rows: TcgplayerMagicCatalogRecord[],
  summary: TcgplayerCatalogImportSummary,
) {
  if (rows.length === 0) return;
  const existing = await existingTcgplayerIds(client, rows.map((row) => row.tcgplayer_id));
  console.info("TCG catalog upsert sample", {
    targetTable: "tcgplayer_magic_catalog",
    conflictKey: "tcgplayer_id",
    batchSize: rows.length,
    dbChunkSize: TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS,
    firstRow: safeCatalogRowSample(rows[0]),
  });

  for (const chunk of chunks(rows, TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS)) {
    const { error } = await client
      .from("tcgplayer_magic_catalog")
      .upsert(chunk, { onConflict: "tcgplayer_id" });
    if (error) throw error;
  }

  for (const row of rows) {
    if (existing.has(row.tcgplayer_id)) summary.updatedRows += 1;
    else summary.insertedRows += 1;
  }
  summary.processedRows += rows.length;
  summary.totalRows += rows.length;
}

async function existingTcgplayerIds(client: SupabaseCatalogClient, ids: number[]) {
  const existing = new Set<number>();
  for (const chunk of chunks(ids, TCGPLAYER_CATALOG_DB_UPSERT_CHUNK_ROWS)) {
    const { data, error } = await client
      .from("tcgplayer_magic_catalog")
      .select("tcgplayer_id")
      .in("tcgplayer_id", chunk);
    if (error) throw error;
    for (const row of data ?? []) existing.add(Number(row.tcgplayer_id));
  }
  return existing;
}

function applyRejectedRows(summary: TcgplayerCatalogImportSummary, rejected: TcgplayerCatalogImportError[]) {
  summary.rejectedRows += rejected.length;
  summary.totalRows += rejected.length;
  for (const error of rejected) {
    if (summary.errors.length < MAX_REPORTED_ERRORS) summary.errors.push(error);
  }
}

export async function downloadSupabaseStorageRange(
  bucket: string,
  path: string,
  startByte: number,
  byteLength: number,
): Promise<TcgplayerStorageDownloadRange> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase service-role credentials are not configured.");
  if (!Number.isSafeInteger(startByte) || startByte < 0) {
    throw new Error(`Invalid storage range start byte: ${startByte}.`);
  }
  if (!Number.isSafeInteger(byteLength) || byteLength <= 0) {
    throw new Error(`Invalid storage range length: ${byteLength}.`);
  }

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const rangeHeader = `bytes=${startByte}-${startByte + byteLength - 1}`;
  const requestUrl = `${url}/storage/v1/object/authenticated/${encodeURIComponent(bucket)}/${encodedPath}`;
  const response = await fetch(requestUrl, {
    headers: {
      apikey: serviceRoleKey,
      authorization: `Bearer ${serviceRoleKey}`,
      range: rangeHeader,
    },
  });
  if (!response.ok) {
    const body = await safeResponseText(response);
    throw new TcgplayerCatalogImportStageError(
      `Could not download ${path}: HTTP ${response.status}. Supabase Storage: ${body || response.statusText || "No response body."}`,
      {
        stage: "range-fetch",
        bucket,
        objectPath: path,
        byteOffset: startByte,
        byteLimit: byteLength,
        rangeHeader,
        status: response.status,
        statusText: response.statusText,
        responseBody: body,
      },
      { status: response.status, statusText: response.statusText, responseBody: body },
      response.status === 404 ? 404 : 502,
    );
  }
  if (response.status === 200 && startByte > 0) {
    throw new Error("Supabase Storage did not honor the range request for a resumed catalog import.");
  }

  const contentRange = response.headers.get("content-range");
  const totalBytes = contentRange?.match(/\/(\d+)$/)?.[1]
    ? Number(contentRange.match(/\/(\d+)$/)?.[1])
    : startByte + Number(response.headers.get("content-length") ?? 0);
  const body = new Uint8Array(await response.arrayBuffer());
  return {
    bytes: body,
    start: startByte,
    end: startByte + body.length - 1,
    totalBytes,
  };
}

async function createStartedRun(
  client: SupabaseStorageCatalogClient,
  options: StorageImportOptions,
  bucket: string,
  prefix: string | null,
  paths: string[],
  logicalImportKey: string,
) {
  await startTcgplayerMagicStorageImport(client, options);
  const row = await findLatestStorageImportRun(client, logicalImportKey);
  if (!row) throw new Error("Could not create TCGplayer storage catalog import.");
  return row;
}

function resultFromImportRun(
  row: ImportRunRow,
  bucket: string,
  prefix: string | null,
  paths: string[],
  skippedCompletedImport: boolean,
): TcgplayerCatalogStorageImportResult {
  const metadata = metadataFromImportRun(row, bucket, prefix, paths);
  const currentPartIndex = metadata.parts.findIndex((part) => part.status !== "completed");
  return {
    importRunId: row.id,
    logicalImportKey: storageImportKey(bucket, prefix, paths),
    bucket,
    prefix,
    parts: metadata.parts,
    summary: summaryFromImportRun(row, metadata),
    status: row.status === "completed" ? "completed" : row.status === "failed" ? "failed" : "processing",
    skippedCompletedImport,
    currentPartIndex,
    currentPartPath: currentPartIndex >= 0 ? metadata.parts[currentPartIndex]?.path ?? null : null,
    batch: {
      attempted: false,
      completedRows: 0,
      completedBytes: 0,
      partCompleted: false,
      importCompleted: row.status === "completed",
    },
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

function normalizeStoragePaths(paths: string[], prefix: string | null = null) {
  return paths
    .map((path) => path.trim().replace(/^\/+/, ""))
    .filter(Boolean)
    .map((path) => {
      if (!prefix) return path;
      if (path.startsWith(prefix)) return path;
      if (path.includes("/")) return path;
      return `${prefix}${path}`;
    })
    .sort((left, right) => left.localeCompare(right, undefined, { numeric: true }));
}

function emptyPart(path: string): TcgplayerCatalogStoragePart {
  return {
    path,
    status: "pending",
    byteOffset: 0,
    totalBytes: null,
    headerValidated: false,
    headers: null,
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
  errors: TcgplayerCatalogImportError[],
): StorageImportMetadata {
  return {
    kind: "tcgplayer-storage-multipart",
    bucket,
    prefix,
    parts,
    errors,
  };
}

function metadataFromImportRun(row: ImportRunRow, bucket: string, prefix: string | null, paths: string[]) {
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

function storageImportCanComplete(
  summary: TcgplayerCatalogImportSummary,
  parts: TcgplayerCatalogStoragePart[],
) {
  return parts.length > 0 &&
    parts.every((part) => part.status === "completed") &&
    !parts.some((part) => part.status === "failed") &&
    summary.totalRows > 0 &&
    summary.processedRows + summary.rejectedRows > 0;
}

function isInvalidCompletedStorageRun(row: ImportRunRow, bucket: string, prefix: string | null, paths: string[]) {
  if (row.status !== "completed") return false;
  const metadata = metadataFromImportRun(row, bucket, prefix, paths);
  const summary = summaryFromImportRun(row, metadata);
  return !storageImportCanComplete(summary, metadata.parts);
}

function summaryFromImportRun(row: ImportRunRow, metadata: StorageImportMetadata): TcgplayerCatalogImportSummary {
  return {
    totalRows: Number(row.total_rows ?? 0),
    processedRows: Number(row.processed_rows ?? 0),
    insertedRows: Number(row.inserted_rows ?? 0),
    updatedRows: Number(row.updated_rows ?? 0),
    rejectedRows: Number(row.rejected_rows ?? 0),
    errors: metadata.errors ?? [],
  };
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

async function verifyStoragePath(
  client: SupabaseStorageCatalogClient,
  bucket: string,
  path: string,
): Promise<TcgplayerStoragePartVerification> {
  const slashIndex = path.lastIndexOf("/");
  const prefix = slashIndex >= 0 ? path.slice(0, slashIndex + 1) : "";
  const name = slashIndex >= 0 ? path.slice(slashIndex + 1) : path;
  const { data, error } = await client.storage.from(bucket).list(prefix);
  if (error) {
    return {
      path,
      exists: false,
      size: null,
      contentType: null,
      error: `Supabase Storage: ${error.message ?? "Could not list storage folder."}`,
    };
  }

  const entry = (data ?? []).find((item) => item.name === name);
  return {
    path,
    exists: Boolean(entry),
    size: entry?.metadata?.size == null ? null : Number(entry.metadata.size),
    contentType: entry?.metadata?.mimetype ?? entry?.metadata?.contentType ?? null,
    error: entry ? undefined : "Storage object not found.",
  };
}

async function runImportStage<T>(
  stage: TcgplayerCatalogImportStage,
  context: Omit<TcgplayerCatalogImportStageContext, "stage">,
  fn: () => Promise<T> | PromiseLike<T>,
): Promise<T> {
  const stageContext = { ...context, stage };
  console.info(`TCG catalog ${stage} started`, stageContext);
  try {
    const result = await fn();
    console.info(`TCG catalog ${stage} succeeded`, stageContext);
    return result;
  } catch (error) {
    console.error("TCG catalog stage failed", { ...stageContext, error: errorForLog(error) });
    if (error instanceof TcgplayerCatalogImportStageError) throw error;
    throw new TcgplayerCatalogImportStageError(
      errorMessage(error, "Catalog import batch failed"),
      stageContext,
      error,
      statusCodeForStage(stage),
    );
  }
}

function runImportStageSync<T>(
  stage: TcgplayerCatalogImportStage,
  context: Omit<TcgplayerCatalogImportStageContext, "stage">,
  fn: () => T,
): T {
  const stageContext = { ...context, stage };
  console.info(`TCG catalog ${stage} started`, stageContext);
  try {
    const result = fn();
    console.info(`TCG catalog ${stage} succeeded`, stageContext);
    return result;
  } catch (error) {
    console.error("TCG catalog stage failed", { ...stageContext, error: errorForLog(error) });
    if (error instanceof TcgplayerCatalogImportStageError) throw error;
    throw new TcgplayerCatalogImportStageError(
      errorMessage(error, "Catalog import batch failed"),
      stageContext,
      error,
      statusCodeForStage(stage),
    );
  }
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (typeof error === "string" && error.trim()) return error;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    for (const key of ["message", "error", "details", "hint"]) {
      const value = record[key];
      if (typeof value === "string" && value.trim()) return value;
    }
    try {
      const serialized = JSON.stringify(error);
      if (serialized && serialized !== "{}") return serialized;
    } catch {
      // Fall through to fallback.
    }
  }
  return fallback;
}

function errorForLog(error: unknown) {
  if (error instanceof TcgplayerCatalogImportStageError) {
    return {
      name: error.name,
      message: error.message || "Unknown error",
      context: error.context,
    };
  }
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message || "Unknown error",
    };
  }
  if (typeof error === "string") return { message: error || "Unknown error" };
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    return {
      message: errorMessage(error, "Unknown error"),
      code: record.code,
      details: record.details,
      hint: record.hint,
      status: record.status,
      statusCode: record.statusCode,
    };
  }
  return { message: String(error ?? "Unknown error") };
}

function statusCodeForStage(stage: TcgplayerCatalogImportStage) {
  if (stage === "verify-parts") return 404;
  if (stage === "range-fetch") return 502;
  return 500;
}

function chunks<T>(values: T[], size: number) {
  const output: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    output.push(values.slice(index, index + size));
  }
  return output;
}

function safeCatalogRowSample(row: TcgplayerMagicCatalogRecord | undefined) {
  if (!row) return null;
  return {
    keys: Object.keys(row),
    tcgplayer_id: row.tcgplayer_id,
    product_line: row.product_line,
    set_name: row.set_name,
    product_name: row.product_name,
    title: row.title,
    collector_number: row.collector_number,
    rarity: row.rarity,
    raw_condition: row.raw_condition,
    condition: row.condition,
    finish: row.finish,
    normalized_set_name: row.normalized_set_name,
    normalized_product_name: row.normalized_product_name,
    normalized_collector_number: row.normalized_collector_number,
    normalized_condition: row.normalized_condition,
    normalized_finish: row.normalized_finish,
    tcg_market_price: row.tcg_market_price,
    tcg_direct_low: row.tcg_direct_low,
    tcg_low_price_with_shipping: row.tcg_low_price_with_shipping,
    tcg_low_price: row.tcg_low_price,
    total_quantity: row.total_quantity,
    add_to_quantity: row.add_to_quantity,
    tcg_marketplace_price: row.tcg_marketplace_price,
    photo_url: row.photo_url ? "[present]" : null,
    source_imported_at: row.source_imported_at,
  };
}

async function safeResponseText(response: Response) {
  try {
    return (await response.text()).trim().slice(0, 1000);
  } catch {
    return "";
  }
}
