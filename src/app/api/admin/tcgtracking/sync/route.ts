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
    const catalogReconciliation = await runTcgTrackingCatalogReconciliation(
      createAdminClient() as unknown as Parameters<typeof runTcgTrackingCatalogReconciliation>[0],
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
        ? `Catalog reconciliation ${catalogReconciliation.recommendation.toUpperCase()}: ${catalogReconciliation.exactSkuMatchRate ?? 0}% exact SKU match across ${catalogReconciliation.productsTested} products.`
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
