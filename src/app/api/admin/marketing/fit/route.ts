import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { buildFeatureFits, hashGenerationInput, type GrowthFeature, type ProspectSignal } from "@/lib/marketing/growth-engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { prospectId?: unknown } | null;
  if (typeof body?.prospectId !== "string") return NextResponse.json({ error: "Prospect ID is required." }, { status: 400 });
  const admin = createAdminClient();
  const [prospect, features, signals] = await Promise.all([
    admin.from("marketing_prospects").select("id").eq("id", body.prospectId).maybeSingle(),
    admin.from("marketing_feature_library").select("id,slug,name,customer_description,relevant_cta,landing_url,approved_claims").eq("status", "active"),
    admin.from("marketing_prospect_signals").select("signal,value,confidence,source_type,source_url").eq("prospect_id", body.prospectId),
  ]);
  if (prospect.error || features.error || signals.error) return NextResponse.json({ error: "Marketing growth tables are not initialized. Apply the documented staging migration first." }, { status: 503 });
  if (!prospect.data) return NextResponse.json({ error: "Prospect not found." }, { status: 404 });
  const fits = buildFeatureFits((features.data ?? []) as GrowthFeature[], (signals.data ?? []) as ProspectSignal[]);
  for (const fit of fits) {
    const result = await admin.from("marketing_prospect_feature_fit").upsert({ prospect_id: body.prospectId, feature_id: fit.feature_id, relevance: fit.relevance, reasons: fit.reasons, created_by: actor.user.id, generated_at: new Date().toISOString() }, { onConflict: "prospect_id,feature_id" });
    if (result.error) return NextResponse.json({ error: "Feature fit could not be saved." }, { status: 503 });
  }
  await admin.from("marketing_generation_runs").insert({ task_type: "fit", provider: "deterministic", input_hash: hashGenerationInput({ prospectId: body.prospectId, signals }), prospect_id: body.prospectId, status: "completed", completed_at: new Date().toISOString(), metadata: { featureCount: fits.length } });
  return NextResponse.json({ fits });
}
