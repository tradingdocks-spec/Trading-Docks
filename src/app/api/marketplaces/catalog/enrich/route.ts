import { NextRequest, NextResponse } from "next/server";
import { enrichMagicListingTitle } from "@/lib/marketplaces/catalog-enrichment";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 60;

type Snapshot = { inventoryItem?: { product?: { title?: string; imageUrls?: string[] } }; enrichment?: unknown };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to enrich marketplace listings." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { marketplaceId?: string; limit?: number; refresh?: boolean };
  const marketplaceId = (body.marketplaceId ?? "ebay").toLowerCase();
  if (!/^[a-z0-9_-]{2,30}$/.test(marketplaceId)) return NextResponse.json({ error: "Invalid marketplace." }, { status: 400 });
  const limit = Math.min(100, Math.max(1, Number(body.limit) || 50));
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketplace_listing_mappings")
    .select("id,raw_snapshot,match_status,inventory_item_id")
    .eq("user_id", user.id).eq("marketplace_id", marketplaceId)
    .in("match_status", ["unmatched", "suggested"]).order("last_seen_at", { ascending: false }).limit(250);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const eligible = (data ?? []).filter((row) => body.refresh || !(row.raw_snapshot as Snapshot | null)?.enrichment);
  const candidates = eligible.slice(0, limit);
  let exact = 0, suggested = 0, unmatched = 0, unsupported = 0;
  for (const row of candidates) {
    const snapshot = (row.raw_snapshot ?? {}) as Snapshot;
    const title = snapshot.inventoryItem?.product?.title ?? "";
    const enrichment = await enrichMagicListingTitle(title).catch(() => ({
      provider: "scryfall" as const, status: "unmatched" as const, confidence: 0, sourceTitle: title,
      normalizedTitle: "", reason: "The catalog lookup was temporarily unavailable.", enrichedAt: new Date().toISOString(),
    }));
    if (enrichment.status === "exact") exact += 1;
    else if (enrichment.status === "suggested") suggested += 1;
    else if (enrichment.status === "unsupported") unsupported += 1;
    else unmatched += 1;
    const matchStatus = enrichment.status === "exact" ? "suggested" : enrichment.status === "suggested" ? "suggested" : row.match_status;
    const { error: updateError } = await admin.from("marketplace_listing_mappings").update({ raw_snapshot: { ...snapshot, enrichment }, match_status: matchStatus }).eq("id", row.id).eq("user_id", user.id);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
    await new Promise((resolve) => setTimeout(resolve, 85));
  }
  return NextResponse.json({ reviewed: candidates.length, exact, suggested, unmatched, unsupported, remaining: Math.max(0, eligible.length - candidates.length) });
}
