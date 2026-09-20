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
    let packageData = buildMarketingAutopilotPackage(context.features, context.proofs, context.campaigns, context.goldStandards, { audience, objective, channel, focus: body?.focus });
    let capture: { status: "existing_approved_proof_selected" } | { status: "captured"; assetId: string; assetName: string; role: string };

    if (packageData.plan.productProof) {
      capture = { status: "existing_approved_proof_selected" };
    } else {
      const baseUrl = process.env.MARKETING_CAPTURE_BASE_URL;
      if (!baseUrl) {
        return NextResponse.json({ error: "Marketing capture is not configured. Set MARKETING_CAPTURE_BASE_URL before using full Autopilot generation." }, { status: 503 });
      }
      let validateCanonicalCaptureRequest: typeof import("@/lib/marketing/canonical-capture").validateCanonicalCaptureRequest;
      let captureCanonicalPage: typeof import("@/lib/marketing/canonical-capture-runner").captureCanonicalPage;
      let registerCanonicalCapture: typeof import("@/lib/marketing/canonical-capture-registration").registerCanonicalCapture;
      let resolveCanonicalFeatureId: typeof import("@/lib/marketing/canonical-capture-registration").resolveCanonicalFeatureId;
      try {
        const [captureModule, registrationModule, requestModule] = await Promise.all([
          import("@/lib/marketing/canonical-capture-runner"),
          import("@/lib/marketing/canonical-capture-registration"),
          import("@/lib/marketing/canonical-capture"),
        ]);
        captureCanonicalPage = captureModule.captureCanonicalPage;
        registerCanonicalCapture = registrationModule.registerCanonicalCapture;
        resolveCanonicalFeatureId = registrationModule.resolveCanonicalFeatureId;
        validateCanonicalCaptureRequest = requestModule.validateCanonicalCaptureRequest;
      } catch {
        return NextResponse.json({ error: "Canonical product capture is unavailable in this deployment environment." }, { status: 503 });
      }
      const state = packageData.feature.recommendedCaptureStates.find((item) => item.id === "primary") ?? packageData.feature.recommendedCaptureStates[0];
      if (!state) return NextResponse.json({ error: "No canonical product capture state is configured for this feature." }, { status: 503 });
      const request = validateCanonicalCaptureRequest({ feature: packageData.feature.slug, state: state.id, viewport: "desktop", role: "primary" });
      const featureId = await resolveCanonicalFeatureId(packageData.feature.slug);
      if (!featureId) return NextResponse.json({ error: "The canonical capture feature is not initialized." }, { status: 503 });

      let captured: Awaited<ReturnType<typeof captureCanonicalPage>> | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          captured = await captureCanonicalPage(request, { baseUrl, featureId, storageState: process.env.MARKETING_CAPTURE_STORAGE_STATE });
          break;
        } catch { /* Retry once without exposing browser/runtime details. */ }
      }
      if (!captured) {
        return NextResponse.json({ error: "Canonical product capture is unavailable in this deployment environment. No campaign was created." }, { status: 503 });
      }
      try {
        const asset = await registerCanonicalCapture(captured.metadata, captured.png);
        packageData = { ...packageData, plan: { ...packageData.plan, productProof: { id: asset.id, name: asset.name, role: "primary", source: "canonical_product_capture" } } };
        capture = { status: "captured", assetId: asset.id, assetName: asset.name, role: "primary" };
      } catch {
        return NextResponse.json({ error: "Canonical product proof registration failed. No campaign was created." }, { status: 503 });
      }
    }

    const admin = createAdminClient();
    const campaign = await admin.from("marketing_outbound_campaigns").insert({ name: `${packageData.feature.name} · ${objective}`, feature_id: packageData.feature.id, audience, objective, cta: packageData.copy.cta, landing_url: packageData.feature.landingUrl, creative_brief: packageData, created_by: actor.user.id }).select("id,name,status,feature_id,audience,objective,cta,landing_url").single();
    if (campaign.error || !campaign.data) return NextResponse.json({ error: "Campaign package could not be stored." }, { status: 503 });
    const brief = await admin.from("marketing_creative_briefs").insert({ campaign_id: campaign.data.id, brief: packageData, created_by: actor.user.id }).select("id,status").single();
    if (brief.error || !brief.data) return NextResponse.json({ error: "Campaign was created, but its brief could not be stored." }, { status: 503 });
    return NextResponse.json({ campaign: campaign.data, brief: brief.data, package: packageData, links: { review: `/dashboard/admin/marketing/campaigns/${campaign.data.id}`, creativeStudio: `/dashboard/admin/marketing/creative-studio?campaign=${campaign.data.id}` }, capture, autonomousActions: packageData.autonomousActions }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketing Autopilot could not build this package." }, { status: 409 });
  }
}
