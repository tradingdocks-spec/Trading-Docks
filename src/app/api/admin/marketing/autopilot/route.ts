import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketingAutopilotPackage } from "@/lib/marketing/marketing-autopilot";
import { loadMarketingIntelligenceContext } from "@/app/api/admin/marketing/intelligence/route";
import { registryFeatureFor } from "@/lib/marketing/product-marketing-registry";
import type { IntelligenceProof } from "@/lib/marketing/marketing-intelligence";
import { randomUUID } from "node:crypto";
import { renderAutopilotVariants } from "@/lib/marketing/marketing-autopilot-rendering";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const audiences = ["local_game_store", "multi_location_store", "high_volume_online_seller", "collector", "other"] as const;
const objectives = ["awareness", "workflow_education", "demo_request", "product_launch", "re_engagement"] as const;
const channels = ["instagram", "facebook", "email", "website", "multi_channel"] as const;

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json({ audiences, objectives, channels, pipeline: ["Analyzing product", "Creating product proof", "Developing campaign angle", "Generating creative directions", "Rendering assets", "Preparing campaign package"] });
}

async function captureMissingProof(featureSlug: string): Promise<{ proof: IntelligenceProof; assetId: string; assetName: string; role: string }> {
  const baseUrl = process.env.MARKETING_CAPTURE_BASE_URL;
  if (!baseUrl) throw new Error("Marketing capture is not configured. Set MARKETING_CAPTURE_BASE_URL before using full Autopilot generation.");
  const secret = process.env.MARKETING_CAPTURE_SECRET;
  if (!secret) throw new Error("Marketing capture signing is not configured.");

  let captureCanonicalPage: typeof import("@/lib/marketing/canonical-capture-runner").captureCanonicalPage;
  let registerCanonicalCapture: typeof import("@/lib/marketing/canonical-capture-registration").registerCanonicalCapture;
  let resolveCanonicalFeatureId: typeof import("@/lib/marketing/canonical-capture-registration").resolveCanonicalFeatureId;
  let validateCanonicalCaptureRequest: typeof import("@/lib/marketing/canonical-capture").validateCanonicalCaptureRequest;
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
    throw new Error("Canonical product capture is unavailable in this deployment environment.");
  }

  const feature = registryFeatureFor(featureSlug);
  if (!feature) throw new Error("Selected feature is not available for canonical marketing capture.");
  const state = feature.recommendedCaptureStates[0]?.id;
  if (!state) throw new Error("No approved canonical capture state is configured for this feature.");

  const featureId = await resolveCanonicalFeatureId(featureSlug);
  if (!featureId) throw new Error("The canonical capture feature is not initialized.");

  const request = validateCanonicalCaptureRequest({
    feature: featureSlug,
    state,
    viewport: "desktop",
    role: "primary",
    width: 1440,
    height: 1000,
  });

  let captured: Awaited<ReturnType<typeof captureCanonicalPage>> | null = null;
  let captureError: unknown = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      captured = await captureCanonicalPage(request, {
        baseUrl,
        featureId,
        secret,
      });
      captureError = null;
      break;
    } catch (error) {
      captureError = error;
    }
  }

  if (!captured) {
    throw new Error(captureError instanceof Error && captureError.message === "Canonical capture page timed out." ? captureError.message : "Canonical product capture is unavailable in this deployment environment.");
  }

  const asset = await registerCanonicalCapture(captured.metadata, Buffer.from(captured.png));
  return {
    proof: {
      id: asset.id,
      name: asset.name,
      featureIds: captured.metadata.featureIds,
      role: captured.metadata.screenshotRole,
      source: "canonical_product_capture",
      approved: true,
      marketingApproved: true,
      archived: false,
    },
    assetId: asset.id,
    assetName: asset.name,
    role: captured.metadata.screenshotRole,
  };
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
    let capture:
      | { status: "existing_approved_proof_selected" }
      | { status: "captured"; assetId: string; assetName: string; role: string };

    if (packageData.plan.productProof) {
      capture = { status: "existing_approved_proof_selected" };
    } else {
      const created = await captureMissingProof(packageData.feature.slug);
      packageData = buildMarketingAutopilotPackage(
        context.features,
        [...context.proofs, created.proof],
        context.campaigns,
        context.goldStandards,
        { audience, objective, channel, focus: packageData.feature.slug },
      );
      if (!packageData.plan.productProof) throw new Error("Canonical product capture completed, but the proof could not be attached to the campaign.");
      capture = { status: "captured", assetId: created.assetId, assetName: created.assetName, role: created.role };
    }

    const admin = createAdminClient();
    const proofId = packageData.plan.productProof?.id;
    if (!proofId) return NextResponse.json({ error: "A product proof is required before the campaign can be created." }, { status: 503 });
    const proofRecord = await admin.from("marketing_assets").select("storage_path,mime_type").eq("id", proofId).maybeSingle();
    if (proofRecord.error || !proofRecord.data?.storage_path) return NextResponse.json({ error: "The selected product proof could not be loaded. No campaign was created." }, { status: 503 });
    const proofDownload = await admin.storage.from("marketing-assets").download(proofRecord.data.storage_path);
    if (proofDownload.error || !proofDownload.data) return NextResponse.json({ error: "The selected product proof could not be loaded. No campaign was created." }, { status: 503 });
    let renderedVariants;
    try {
      const rendered = await renderAutopilotVariants(packageData, Buffer.from(await proofDownload.data.arrayBuffer()));
      const renderBatch = randomUUID();
      renderedVariants = await Promise.all(rendered.map(async (variant) => {
        const storagePath = `autopilot/${renderBatch}/${variant.filename}`;
        const upload = await admin.storage.from("marketing-assets").upload(storagePath, variant.png, { contentType: "image/png", upsert: false });
        if (upload.error) throw new Error("Rendered creative upload failed.");
        const metadata = await admin.from("marketing_assets").insert({ name: variant.filename.replace(/\.png$/, ""), asset_type: "social_export", storage_path: storagePath, mime_type: "image/png", width: variant.width, height: variant.height, feature_ids: [packageData.feature.id], tags: [`platform:${variant.platform}`, "source:marketing_autopilot"], approved_for_marketing: false, approval_status: "draft", source: "marketing_autopilot_render", marketing_use_approved: false, product_display_allowed: false, created_by: actor.user.id }).select("id,name,storage_path,width,height,approval_status").single();
        if (metadata.error || !metadata.data) throw new Error("Rendered creative registration failed.");
        const signed = await admin.storage.from("marketing-assets").createSignedUrl(storagePath, 600);
        return { platform: variant.platform, width: variant.width, height: variant.height, filename: variant.filename, assetId: metadata.data.id, previewUrl: signed.data?.signedUrl ?? null };
      }));
    } catch {
      return NextResponse.json({ error: "Creative rendering or registration failed. No campaign was created." }, { status: 503 });
    }
    packageData = { ...packageData, renderedVariants };
    const campaign = await admin.from("marketing_outbound_campaigns").insert({
      name: `${packageData.feature.name} · ${objective}`,
      feature_id: packageData.feature.id,
      audience,
      objective,
      cta: packageData.copy.cta,
      landing_url: packageData.feature.landingUrl,
      creative_brief: packageData,
      created_by: actor.user.id,
    }).select("id,name,status,feature_id,audience,objective,cta,landing_url").single();
    if (campaign.error || !campaign.data) return NextResponse.json({ error: "Campaign package could not be stored." }, { status: 503 });

    const brief = await admin.from("marketing_creative_briefs").insert({
      campaign_id: campaign.data.id,
      brief: packageData,
      created_by: actor.user.id,
    }).select("id,status").single();
    if (brief.error || !brief.data) return NextResponse.json({ error: "Campaign was created, but its brief could not be stored." }, { status: 503 });

    return NextResponse.json({
      campaign: campaign.data,
      brief: brief.data,
      package: packageData,
      links: {
        review: `/dashboard/admin/marketing/campaigns/${campaign.data.id}`,
        creativeStudio: `/dashboard/admin/marketing/creative-studio?campaign=${campaign.data.id}`,
      },
      capture,
      autonomousActions: packageData.autonomousActions,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketing Autopilot could not build this package." }, { status: 409 });
  }
}
