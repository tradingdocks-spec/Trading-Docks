import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  importTcgplayerMagicCatalogCsv,
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

function databaseError(error: unknown, fallback: string) {
  if (error && typeof error === "object" && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
  }
  return error instanceof Error ? error.message : fallback;
}

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
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
    });
  } catch (error) {
    return NextResponse.json({
      error: databaseError(error, "Could not load TCGplayer catalog status."),
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });

  try {
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
    return NextResponse.json({
      error: databaseError(error, "Could not process TCGplayer catalog CSV."),
    }, { status: 400 });
  }
}
