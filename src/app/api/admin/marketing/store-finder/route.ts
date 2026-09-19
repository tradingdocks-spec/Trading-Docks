import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { discoverStores, validateStoreSearch, StoreFinderConfigurationError, StoreFinderProviderError } from "@/lib/marketing/store-finder";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { postalCode?: unknown; radius?: unknown; broaderMatches?: unknown } | null;
  try {
    const search = validateStoreSearch(String(body?.postalCode ?? ""), Number(body?.radius ?? 25));
    const stores = await discoverStores(search.postalCode, search.radius, fetch, { broaderMatches: body?.broaderMatches === true });
    const { error } = await createAdminClient().from("marketing_searches").insert({ actor_user_id: actor.user.id, postal_code: search.postalCode, radius_miles: search.radius, result_count: stores.length, provider_status: "completed" });
    if (error && !/relation .* does not exist|schema cache/i.test(error.message)) throw error;
    return NextResponse.json({ stores, provider: "google_places", resultCount: stores.length });
  } catch (error) {
    const status = error instanceof StoreFinderConfigurationError ? 503 : error instanceof StoreFinderProviderError ? 502 : 400;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Store search failed." }, { status });
  }
}
