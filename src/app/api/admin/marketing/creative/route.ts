import { NextResponse } from "next/server";

import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { buildCreativeBrief, buildOutreachDraft, hashGenerationInput, type GrowthFeature, type GrowthProspect } from "@/lib/marketing/growth-engine";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: unknown; campaignId?: unknown; prospectId?: unknown; featureId?: unknown } | null;
  if (body?.action !== "generate") return NextResponse.json({ error: "A supported creative action is required." }, { status: 400 });
  if (typeof body.prospectId !== "string" || typeof body.featureId !== "string") return NextResponse.json({ error: "Prospect and feature are required." }, { status: 400 });
  const admin = createAdminClient();
  const [prospectResult, featureResult, fitResult] = await Promise.all([
    admin.from("marketing_prospects").select("id,business_name,city,state,website_url,public_email,category").eq("id", body.prospectId).maybeSingle(),
    admin.from("marketing_feature_library").select("id,slug,name,customer_description,relevant_cta,landing_url,approved_claims").eq("id", body.featureId).maybeSingle(),
    admin.from("marketing_prospect_feature_fit").select("reasons").eq("prospect_id", body.prospectId).eq("feature_id", body.featureId).maybeSingle(),
  ]);
  if (prospectResult.error || featureResult.error || fitResult.error) return NextResponse.json({ error: "Marketing growth tables are not initialized. Apply the documented staging migration first." }, { status: 503 });
  if (!prospectResult.data || !featureResult.data) return NextResponse.json({ error: "Prospect or feature not found." }, { status: 404 });
  const prospect = prospectResult.data as GrowthProspect;
  const feature = featureResult.data as GrowthFeature;
  const reasons = Array.isArray(fitResult.data?.reasons) ? fitResult.data.reasons as Array<{ signal: string; explanation: string }> : [];
  const brief = buildCreativeBrief(feature, prospect, reasons);
  const copy = buildOutreachDraft(feature, prospect, reasons);
  let campaignId = typeof body.campaignId === "string" ? body.campaignId : null;
  if (!campaignId) {
    const campaign = await admin.from("marketing_outbound_campaigns").insert({ name: `${feature.name} · ${prospect.business_name}`, feature_id: feature.id, audience: prospect.category || "local_game_store", objective: "outbound email", cta: feature.relevant_cta, landing_url: feature.landing_url, creative_brief: brief, created_by: actor.user.id }).select("id").single();
    if (campaign.error || !campaign.data) return NextResponse.json({ error: "Campaign could not be created." }, { status: 503 });
    campaignId = campaign.data.id;
  }
  const briefResult = await admin.from("marketing_creative_briefs").insert({ campaign_id: campaignId, prospect_id: prospect.id, brief, created_by: actor.user.id }).select("id").single();
  if (briefResult.error || !briefResult.data) return NextResponse.json({ error: "Creative brief could not be saved." }, { status: 503 });
  const creative = await admin.from("marketing_creatives").insert({ campaign_id: campaignId, brief_id: briefResult.data.id, name: `${feature.name} workflow`, composition_family: brief.compositionFamily, platform: "email", variant_key: "A", copy_payload: copy, created_by: actor.user.id }).select("id").single();
  if (creative.error || !creative.data) return NextResponse.json({ error: "Creative could not be saved." }, { status: 503 });
  const draft = await admin.from("marketing_outreach_drafts").insert({ prospect_id: prospect.id, campaign_id: campaignId, creative_id: creative.data.id, subject: copy.subject, preview_text: copy.previewText, body_text: copy.bodyText, rationale: copy.rationale, created_by: actor.user.id }).select("id,status,subject,preview_text,body_text").single();
  if (draft.error || !draft.data) return NextResponse.json({ error: "Outreach draft could not be saved." }, { status: 503 });
  await admin.from("marketing_generation_runs").insert({ task_type: "creative_brief", provider: "deterministic", input_hash: hashGenerationInput({ campaignId, prospect, feature, reasons }), campaign_id: campaignId, prospect_id: prospect.id, status: "completed", completed_at: new Date().toISOString(), metadata: { briefId: briefResult.data.id, creativeId: creative.data.id } });
  await admin.from("marketing_activities").insert({ prospect_id: prospect.id, actor_user_id: actor.user.id, activity_type: "outreach_draft_generated", body: "Generated a reviewable outreach draft from approved feature claims.", metadata: { campaignId, featureId: feature.id } });
  return NextResponse.json({ campaignId, brief, creativeId: creative.data.id, draft: draft.data }, { status: 201 });
}
