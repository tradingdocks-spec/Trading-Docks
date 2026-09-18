import { NextResponse } from "next/server";

import { createSellingListingBatch, loadSellableInventoryPage } from "@/lib/selling/candidate-service";
import { createClient } from "@/lib/supabase/server";

async function actorContext() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, workspaceId: null };
  const { data: preferences } = await supabase.from("user_preferences").select("active_workspace_id").eq("user_id", user.id).maybeSingle();
  return { supabase, user, workspaceId: preferences?.active_workspace_id as string | null };
}

export async function GET(request: Request) {
  const { supabase, user, workspaceId } = await actorContext();
  if (!user || !workspaceId) return NextResponse.json({ error: "Authentication and an active workspace are required." }, { status: 401 });
  const url = new URL(request.url);
  try {
    const result = await loadSellableInventoryPage({
      supabase,
      userId: user.id,
      workspaceId,
      page: Number(url.searchParams.get("page") ?? 1),
      filters: {
        query: url.searchParams.get("q") ?? undefined,
        setCode: url.searchParams.get("set") ?? undefined,
        condition: url.searchParams.get("condition") ?? undefined,
        finish: url.searchParams.get("finish") ?? undefined,
        language: url.searchParams.get("language") ?? undefined,
        locationId: url.searchParams.get("location") ?? undefined,
        batchId: url.searchParams.get("batch") ?? undefined,
        listingState: (url.searchParams.get("state") as "available" | "allocated" | "all" | null) ?? "available",
      },
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Sellable inventory is unavailable." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const { supabase, user, workspaceId } = await actorContext();
  if (!user || !workspaceId) return NextResponse.json({ error: "Authentication and an active workspace are required." }, { status: 401 });
  const body = await request.json().catch(() => null) as { name?: unknown; source?: unknown; candidates?: unknown } | null;
  if (typeof body?.name !== "string" || !Array.isArray(body.candidates)) return NextResponse.json({ error: "A batch name and candidate rows are required." }, { status: 400 });
  try {
    const result = await createSellingListingBatch({ supabase, workspaceId, name: body.name, source: typeof body.source === "string" ? body.source : "inventory", candidates: body.candidates as never[] });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Listing batch could not be created." }, { status: 400 });
  }
}
