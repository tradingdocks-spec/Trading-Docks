import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import {
  latestSyncByType,
  loadTcgTrackingProviderHealth,
  type TcgTrackingSyncRunRow,
} from "@/lib/providers/tcgtracking";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const actor = await requireAdminActor();
  if (!actor) {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 },
    );
  }

  const health = await loadTcgTrackingProviderHealth();
  const sync = await loadSyncSummary();
  return NextResponse.json({ ...health, sync }, {
    status: health.status === "available" ? 200 : 502,
  });
}

async function loadSyncSummary() {
  try {
    const { data, error } = await createAdminClient()
      .from("tcgtracking_sync_runs")
      .select("id,category_id,sync_type,status,checkpoint,processed,inserted,updated,failed,error_summary,started_at,completed_at,updated_at")
      .eq("category_id", "1")
      .in("sync_type", ["product_mappings", "price_snapshots", "sample_reconciliation"])
      .order("started_at", { ascending: false })
      .limit(12);
    if (error) return undefined;
    const latest = latestSyncByType((data ?? []) as TcgTrackingSyncRunRow[]);
    return {
      mapping: summarizeRun(latest.mapping),
      pricing: summarizeRun(latest.pricing),
    };
  } catch {
    return undefined;
  }
}

function summarizeRun(run: TcgTrackingSyncRunRow | null) {
  if (!run) return null;
  return {
    status: run.status,
    processed: run.processed,
    updatedAt: run.updated_at,
    completedAt: run.completed_at,
  };
}

async function requireAdminActor() {
  try {
    return await requireServerPlatformRole("admin");
  } catch {
    return null;
  }
}
