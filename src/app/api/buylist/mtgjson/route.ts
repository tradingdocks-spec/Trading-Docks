import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { syncMtgjsonForUser } from "@/lib/buylist/mtgjson";
import { getEffectivePlan } from "@/lib/effective-plan";
import { hasPlanAccess } from "@/lib/tier-access";

async function requireFeatureAccess() {
  if (!hasPlanAccess(await getEffectivePlan(), "purchasing")) {
    return NextResponse.json(
      { error: "Purchasing requires a higher Trading Docks plan." },
      { status: 403 },
    );
  }
  return null;
}

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST() {
  const accessDenied = await requireFeatureAccess();
  if (accessDenied) return accessDenied;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: "Automatic sync is not configured on the server." }, { status: 503 });
  try {
    const admin = createAdminClient();
    const { data: recent } = await admin.from("buylist_feed_connections").select("last_sync_at")
      .eq("user_id", user.id).eq("provider", "mtgjson_cardkingdom").maybeSingle();
    if (recent?.last_sync_at && Date.now() - new Date(recent.last_sync_at).getTime() < 10 * 60_000) {
      return NextResponse.json({ error: "A sync was started recently. Please wait a few minutes before trying again." }, { status: 429 });
    }
    return NextResponse.json({ success: true, result: await syncMtgjsonForUser(admin, user.id) });
  } catch (error) {
    console.error("MTGJSON buylist sync failed:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Automatic sync failed." }, { status: 502 });
  }
}

export async function GET(request: NextRequest) {
  const accessDenied = await requireFeatureAccess();
  if (accessDenied) return accessDenied;
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const { data, error } = await admin.from("buylist_feed_connections").select("user_id,last_success_at")
    .eq("provider", "mtgjson_cardkingdom").eq("enabled", true).or(`last_success_at.is.null,last_success_at.lt.${cutoff}`).limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const results = [];
  for (const connection of data ?? []) {
    try { results.push({ userId: connection.user_id, success: true, ...(await syncMtgjsonForUser(admin, connection.user_id)) }); }
    catch (cause) { results.push({ userId: connection.user_id, success: false, error: cause instanceof Error ? cause.message : "Sync failed." }); }
  }
  return NextResponse.json({ success: true, processed: results.length, results });
}
