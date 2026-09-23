import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";
import { validateLiveCommit } from "@/lib/chaos-sort/live-intake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChaosSortCommitItem = {
  id: string;
  cardName: string;
  gameId: string;
  setCode: string | null;
  collectorNumber: string | null;
  rarity: string | null;
  finish: string | null;
  condition: string | null;
  quantity: number;
  marketPrice: number | null;
  existingOwnedQuantity: number;
  destinationLocationId: string | null;
  destinationLabel: string;
  recognitionState: "high_confidence" | "review" | "unknown";
  humanState: "pending" | "confirmed" | "edited" | "unknown" | "removed";
  sourceFileName: string;
  sourceFileHash: string;
  sourceImageUrl: string | null;
  evidence: string[];
  notes: string;
  duplicateOfItemId: string | null;
};

type CommitPayload = {
  batch: {
    id: string;
    batchCode: string;
    title: string;
    destinationLocationId: string | null;
    destinationLabel: string;
    acquisitionCost: number | null;
    status: string;
    intakeMode?: string;
    sourceCount: number;
    duplicateCount: number;
    estimatedMarketValue: number;
    createdAt: string;
    updatedAt: string;
  };
  items: ChaosSortCommitItem[];
  rules: Array<Record<string, unknown>>;
};

export async function POST(request: Request) {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  const userId = capability.user?.id ?? "";
  if (!userId) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const payload = await request.json().catch(() => null) as CommitPayload | null;
  if (!payload?.batch || !Array.isArray(payload.items) || !payload.items.length) {
    return NextResponse.json({ error: "Chaos Sort requires at least one reviewed item before commit." }, { status: 400 });
  }

  if (payload.batch.intakeMode === "live") {
    const validation = validateLiveCommit(payload.items);
    if (validation) return NextResponse.json({ error: validation }, { status: 400 });
  }

  const { data, error } = await (capability.supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error?: { message?: string; code?: string } | null }>;
  }).rpc("commit_chaos_sort_batch", { payload });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message ?? "Chaos Sort batch commit failed." }, { status: 409 });
  }
  return NextResponse.json(data ?? { ok: true, batchId: payload.batch.id });
}
