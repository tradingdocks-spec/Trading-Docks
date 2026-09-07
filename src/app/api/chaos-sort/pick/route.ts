import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  const body = await request.json().catch(() => null) as { positionId?: string; quantity?: number } | null;
  if (!body?.positionId) return NextResponse.json({ ok: false, error: "Position id is required." }, { status: 400 });
  const { data, error } = await (capability.supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error?: { message?: string } | null }>;
  }).rpc("pick_chaos_sort_position", { target_position_id: body.positionId, pick_quantity: body.quantity ?? 1 });
  if (error) return NextResponse.json({ ok: false, error: error.message ?? "Pick failed." }, { status: 409 });
  return NextResponse.json(data ?? { ok: true });
}
