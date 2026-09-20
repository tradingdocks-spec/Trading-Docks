import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketingAutopilotPackage } from "@/lib/marketing/marketing-autopilot";
import { loadMarketingIntelligenceContext } from "@/app/api/admin/marketing/intelligence/route";

export const dynamic = "force-dynamic";

const audiences = ["local_game_store", "multi_location_store", "high_volume_online_seller", "collector", "other"] as const;
const objectives = ["awareness", "workflow_education", "demo_request", "product_launch", "re_engagement"] as const;
const channels = ["instagram", "facebook", "email", "website", "multi_channel"] as const;

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json({ audiences, objectives, channels, pipeline: ["Analyzing product", "Creating product proof", "Developing campaign angle", "Generating creative directions", "Rendering assets", "Preparing campaign package"] });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { audience?: string; objective?: string; channel?: string; focus?: string } | null;
  const audience = audiences.includes(body?.audience as typeof audiences[number]) ? body!.audience as typeof audiences[number] : "local_game_store";
  const objective = objectives.includes(body?.objective as typeof objectives[number]) ? body!.objective as typeof objectives[number] : "awareness";
  const channel = channels.includes(body?.channel as typeof channels[number]) ? body!.channel as typeof channels[number] : "instagram";
  try {
    const context = await loadMarketingIntelligenceContext();
    const packageData = buildMarketingAutopilotPackage(context.features, context.proofs, context.campaigns, context.goldStandards, { audience, objective, channel, focus: body?.focus });
    const admin = createAdminClient();
    const campaign = await admin.from("marketing_outbound_campaigns").insert({ name: `${packageData.feature.name} · ${objective}`, feature_id: packageData.feature.id, audience, objective, cta: packageData.copy.cta, landing_url: packageData.feature.landingUrl, creative_brief: packageData, created_by: actor.user.id }).select("id,name,status,feature_id,audience,objective,cta,landing_url").single();
    if (campaign.error || !campaign.data) return NextResponse.json({ error: "Campaign package could not be stored." }, { status: 503 });
    const brief = await admin.from("marketing_creative_briefs").insert({ campaign_id: campaign.data.id, brief: packageData, created_by: actor.user.id }).select("id,status").single();
    if (brief.error || !brief.data) return NextResponse.json({ error: "Campaign was created, but its brief could not be stored." }, { status: 503 });
    return NextResponse.json({ campaign: campaign.data, brief: brief.data, package: packageData, links: { review: `/dashboard/admin/marketing/campaigns/${campaign.data.id}`, creativeStudio: `/dashboard/admin/marketing/creative-studio?campaign=${campaign.data.id}` }, capture: packageData.plan.productProof ? { status: "existing_approved_proof_selected" } : { status: "required_before_export", message: "No approved product proof is available; capture is required before export." }, autonomousActions: packageData.autonomousActions }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketing Autopilot could not build this package." }, { status: 409 });
  }
}
