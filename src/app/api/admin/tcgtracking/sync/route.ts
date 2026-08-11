import { NextRequest, NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import {
  advanceTcgTrackingMagicSync,
  loadTcgTrackingProviderHealth,
  type TcgTrackingSyncType,
} from "@/lib/providers/tcgtracking";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SyncAction =
  | "validate_magic"
  | "reconcile_sample"
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

  if (action === "reconcile_sample") {
    return NextResponse.json({
      action,
      status: "manual_command_required",
      message:
        "Run scripts/tcgtracking/live-validation.ts from an environment with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to create the exact local catalog reconciliation report.",
      command:
        "node --experimental-strip-types scripts/tcgtracking/live-validation.ts --sample-size 51 --output artifacts/tcgtracking-reconciliation.json",
    }, { status: 202 });
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
