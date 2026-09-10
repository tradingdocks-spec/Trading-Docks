import { NextResponse } from "next/server";

import { requireApiCapability } from "@/lib/platform/server-access";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const capability = await requireApiCapability("collection.write");
  if (!capability.ok) return capability.response;
  const body = await request.json().catch(() => null) as { batchId?: string } | null;
  if (!body?.batchId) return NextResponse.json({ ok: false, error: "Batch id is required." }, { status: 400 });
  const { data, error } = await (capability.supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error?: { message?: string } | null }>;
  }).rpc("retire_chaos_sort_batch", { target_batch_id: body.batchId });
  if (error) return NextResponse.json({ ok: false, error: error.message ?? "Batch could not be retired." }, { status: 409 });
  return NextResponse.json(data ?? { ok: true });
}
