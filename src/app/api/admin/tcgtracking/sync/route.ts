import { NextRequest, NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import {
  advanceTcgTrackingMagicSync,
  loadTcgTrackingProviderHealth,
  runTcgTrackingCatalogReconciliation,
  type TcgTrackingSyncType,
} from "@/lib/providers/tcgtracking";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncAction =
  | "validate_magic"
  | "reconcile_sample"
  | "run_catalog_reconciliation"
  | "sync_magic_mappings"
  | "refresh_magic_pricing";

export async function POST(request: NextRequest) {
  const actor = await requireAdminActor();
  if (!actor) {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }

  const payload = await request.json().catch(() => ({})) as {
    action?: SyncAction;
  };
  const action = payload.action;

  if (action === "validate_magic") {
    const health = await loadTcgTrackingProviderHealth();
    return NextResponse.json({
      action,
      status: health.status,
      providerHealth: health,
    }, { status: health.status === "available" ? 200 : 502 });
  }

  if (action === "reconcile_sample" || action === "run_catalog_reconciliation") {
    let adminClient: ReturnType<typeof createAdminClient>;
    try {
      adminClient = createAdminClient();
    } catch {
      return NextResponse.json({
        action,
        status: "catalog_read_failed",
        message: "Supabase server configuration unavailable.",
        catalogReconciliation: {
          status: "catalog_read_failed",
          readiness: "FAILED",
          generatedAt: new Date().toISOString(),
          sampleSize: 150,
          categoryId: "1",
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
          error: "Supabase server configuration unavailable.",
          localCatalog: {
            status: "failed",
            table: "tcgplayer_magic_catalog",
            schema: "failed",
            rows: null,
            sampleRowAvailable: false,
            smokeQuery: "tcgplayer_id limit 1",
            requestedColumns: "tcgplayer_id",
            error: {
              message: "Supabase server configuration unavailable.",
            },
          },
          failure: {
            stage: "local-catalog-read",
            table: "tcgplayer_magic_catalog",
            requestedColumns: "tcgplayer_id",
            message: "Supabase server configuration unavailable.",
          },
        },
      }, { status: 500 });
    }

    const catalogReconciliation = await runTcgTrackingCatalogReconciliation(
      adminClient as unknown as Parameters<typeof runTcgTrackingCatalogReconciliation>[0],
      {
        sampleSize: 150,
        conflictLimit: 25,
      },
    );
    const status = catalogReconciliation.status === "completed"
      ? 200
      : catalogReconciliation.status === "catalog_read_failed"
        ? 500
        : 502;
    return NextResponse.json({
      action,
      status: catalogReconciliation.status,
      message: catalogReconciliation.status === "completed"
        ? `Catalog reconciliation ${catalogReconciliation.readiness}: ${catalogReconciliation.exactSkuMatchRate ?? 0}% exact SKU match across ${catalogReconciliation.productsTested} products.`
        : catalogReconciliation.error ?? "TCGTracking catalog reconciliation failed.",
      catalogReconciliation,
    }, { status });
  }

  const syncType = syncTypeForAction(action);
  if (!syncType) {
    return NextResponse.json(
      { error: "Unsupported TCGTracking sync action." },
      { status: 400 },
    );
  }

  const result = await advanceTcgTrackingMagicSync(
    createAdminClient() as unknown as Parameters<typeof advanceTcgTrackingMagicSync>[0],
    { syncType },
  );
  const status = result.status === "schema_required"
    ? 409
    : result.status === "provider_failed"
      ? 502
      : 200;

  return NextResponse.json({ action, ...result }, { status });
}

function syncTypeForAction(action: SyncAction | undefined): TcgTrackingSyncType | null {
  if (action === "sync_magic_mappings") return "product_mappings";
  if (action === "refresh_magic_pricing") return "price_snapshots";
  return null;
}

async function requireAdminActor() {
  try {
    return await requireServerPlatformRole("admin");
  } catch {
    return null;
  }
}
