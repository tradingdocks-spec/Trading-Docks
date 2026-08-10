import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { serializeError } from "@/lib/tcgplayer-catalog/error-serialization";
import {
  advanceTcgplayerMagicStorageImport,
  importTcgplayerMagicCatalogCsv,
  resolveTcgplayerMagicStorageParts,
  startTcgplayerMagicStorageImport,
  TCGPLAYER_MAGIC_STORAGE_BUCKET,
  TCGPLAYER_MAGIC_STORAGE_PARTS,
  TCGPLAYER_MAGIC_STORAGE_PREFIX,
  TcgplayerCatalogImportStageError,
  verifyTcgplayerMagicStorageParts,
  type SupabaseCatalogClient,
} from "@/lib/tcgplayer-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type CatalogStatsClient = {
  rpc: (name: "tcgplayer_magic_catalog_stats") => PromiseLike<{
    data: Array<{
      total_records: number | string | null;
      unique_products: number | string | null;
      sets: number | string | null;
      last_import: unknown;
    }> | null;
    error: { message?: string } | null;
  }>;
};

function catalogErrorResponse(error: unknown, fallback: string, defaultStatus = 500) {
  const serialized = serializeError(error);
  const cause = serialized.cause;
  const errorDetails = cause ?? serialized;
  const stageError = error instanceof TcgplayerCatalogImportStageError ? error : null;
  const responseStatus = safeStatusCode(stageError?.statusCode ?? errorDetails.statusCode ?? errorDetails.status ?? defaultStatus);
  const body = {
    error: fallback,
    stage: stageError?.context.stage,
    message: errorDetails.message || serialized.message || fallback,
    code: errorDetails.code,
    details: errorDetails.details,
    hint: errorDetails.hint,
    status: errorDetails.status,
    statusCode: responseStatus,
    part: stageError?.context.objectPath,
    objectPath: stageError?.context.objectPath,
    bucket: stageError?.context.bucket,
    partIndex: stageError?.context.partIndex,
    byteOffset: stageError?.context.byteOffset,
    rowLimit: stageError?.context.rowLimit,
    byteLimit: stageError?.context.byteLimit,
    rangeHeader: stageError?.context.rangeHeader,
    storageStatus: stageError?.context.status,
    storageStatusText: stageError?.context.statusText,
    responseBody: stageError?.context.responseBody,
  };
  console.error("TCGplayer catalog API failed", { ...body, serialized });
  return NextResponse.json(body, { status: responseStatus });
}

export async function GET() {
  let actor;
  try {
    actor = await requireServerPlatformRole("admin");
  } catch (error) {
    return catalogErrorResponse(
      new TcgplayerCatalogImportStageError("Catalog authorization failed.", { stage: "authorization" }, error, 500),
      "Catalog authorization failed",
      500,
    );
  }
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
    const { data, error } = await (createAdminClient() as CatalogStatsClient)
      .rpc("tcgplayer_magic_catalog_stats");
    if (error) throw error;
    const stats = data?.[0];

    return NextResponse.json({
      totalRecords: Number(stats?.total_records ?? 0),
      uniqueProducts: Number(stats?.unique_products ?? 0),
      sets: Number(stats?.sets ?? 0),
      lastImport: stats?.last_import ?? null,
      defaultStorageImport: {
        bucket: TCGPLAYER_MAGIC_STORAGE_BUCKET,
        prefix: TCGPLAYER_MAGIC_STORAGE_PREFIX,
        paths: TCGPLAYER_MAGIC_STORAGE_PARTS,
      },
    });
  } catch (error) {
    return catalogErrorResponse(error, "Could not load TCGplayer catalog status.", 500);
  }
}

export async function POST(request: Request) {
  console.info("TCGplayer catalog API authorization started", { stage: "authorization" });
  let actor;
  try {
    actor = await requireServerPlatformRole("admin");
  } catch (error) {
    return catalogErrorResponse(
      new TcgplayerCatalogImportStageError("Catalog authorization failed.", { stage: "authorization" }, error, 500),
      "Catalog authorization failed",
      500,
    );
  }
  if (!actor) return NextResponse.json({ error: "Administrator access required.", message: "Administrator access required." }, { status: 403 });
  console.info("TCGplayer catalog API authorization succeeded", { stage: "authorization" });

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      console.info("TCGplayer catalog payload parse started", { stage: "payload-parse" });
      const payload = await request.json().catch((error: unknown) => {
        throw new TcgplayerCatalogImportStageError(
          "Malformed JSON catalog import request.",
          { stage: "payload-parse" },
          error,
          400,
        );
      }) as {
        action?: string;
        bucket?: string;
        prefix?: string | null;
        paths?: string[];
        retryFailed?: boolean;
      };
      const action = payload.action ?? "storage-import";
      console.info("TCGplayer catalog payload parse succeeded", {
        stage: "payload-parse",
        action,
        bucket: payload.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET,
        prefix: payload.prefix ?? TCGPLAYER_MAGIC_STORAGE_PREFIX,
        paths: payload.paths,
      });
      if (!["storage-list", "storage-verify", "storage-start", "storage-advance", "storage-import"].includes(action)) {
        return NextResponse.json({ error: "Unsupported catalog action." }, { status: 400 });
      }

      const adminClient = createAdminClient() as unknown as Parameters<typeof advanceTcgplayerMagicStorageImport>[0];
      if (action === "storage-verify") {
        const parts = await verifyTcgplayerMagicStorageParts(adminClient, {
          bucket: payload.bucket,
          prefix: payload.prefix,
          paths: payload.paths,
        });
        return NextResponse.json({
          ok: true,
          action,
          bucket: payload.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET,
          prefix: payload.prefix ?? TCGPLAYER_MAGIC_STORAGE_PREFIX,
          parts,
          allVerified: parts.length > 0 && parts.every((part) => part.exists),
        });
      }

      if (action === "storage-list") {
        const paths = await resolveTcgplayerMagicStorageParts(adminClient, {
          bucket: payload.bucket,
          prefix: payload.prefix,
          paths: payload.paths,
        });
        return NextResponse.json({
          ok: true,
          action,
          bucket: payload.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET,
          prefix: payload.prefix ?? TCGPLAYER_MAGIC_STORAGE_PREFIX,
          paths,
        });
      }

      const importOptions = {
        actorId: actor.user.id,
        bucket: payload.bucket,
        prefix: payload.prefix,
        paths: payload.paths,
      };
      console.info("TCG catalog advance started", {
        action,
        stage: action === "storage-start" ? "job-create" : "job-lookup",
        bucket: importOptions.bucket ?? TCGPLAYER_MAGIC_STORAGE_BUCKET,
        rowLimit: 10000,
        byteLimit: 4194304,
      });
      const result = action === "storage-start"
        ? await startTcgplayerMagicStorageImport(adminClient, importOptions)
        : await advanceTcgplayerMagicStorageImport(adminClient, importOptions);

      return NextResponse.json({
        ok: true,
        action,
        result,
        summary: result.summary,
      });
    }

    const form = await request.formData();
    const action = String(form.get("action") ?? "validate");
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Upload the TCGplayer Magic CSV file." }, { status: 400 });
    }
    if (action !== "validate" && action !== "import") {
      return NextResponse.json({ error: "Unsupported catalog action." }, { status: 400 });
    }

    const adminClient = createAdminClient() as unknown as SupabaseCatalogClient;
    const summary = await importTcgplayerMagicCatalogCsv(adminClient, file.stream(), {
      actorId: actor.user.id,
      filename: file.name,
      validateOnly: action === "validate",
    });

    return NextResponse.json({
      ok: true,
      action,
      summary,
    });
  } catch (error) {
    return catalogErrorResponse(error, "Catalog import batch failed", 500);
  }
}

function safeStatusCode(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (Number.isInteger(numeric) && numeric >= 400 && numeric <= 599) return numeric;
  return 500;
}
