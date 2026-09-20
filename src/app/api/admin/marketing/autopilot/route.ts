import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildMarketingAutopilotPackage } from "@/lib/marketing/marketing-autopilot";
import { loadMarketingIntelligenceContext } from "@/app/api/admin/marketing/intelligence/route";
import { registryFeatureFor } from "@/lib/marketing/product-marketing-registry";
import type { IntelligenceProof } from "@/lib/marketing/marketing-intelligence";
import { randomUUID } from "node:crypto";
import { renderAutopilotVariants, type RenderedAutopilotVariant } from "@/lib/marketing/marketing-autopilot-rendering";
import { resolveMarketingCaptureBaseUrl } from "@/lib/marketing/canonical-capture-origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const audiences = ["local_game_store", "multi_location_store", "high_volume_online_seller", "collector", "other"] as const;
const objectives = ["awareness", "workflow_education", "demo_request", "product_launch", "re_engagement"] as const;
const channels = ["instagram", "facebook", "email", "website", "multi_channel"] as const;

type AutopilotStage = "CREATIVE_RENDER_FAILED" | "CREATIVE_UPLOAD_FAILED" | "CREATIVE_REGISTRATION_FAILED" | "CREATIVE_PREVIEW_URL_FAILED" | "CAMPAIGN_PERSISTENCE_FAILED";
type PartialAsset = { platform: string; assetId?: string; status: "rendered" | "uploaded" | "registered" | "failed"; errorCode?: string };

function safeProviderError(error: unknown) {
  const value = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : {};
  return String(value.message ?? error ?? "Unknown provider error.")
    .replace(/https?:\/\/\S+/gi, "[remote resource]")
    .replace(/(?:key|secret|token|password)=[^\s&]+/gi, "[redacted]")
    .slice(0, 240);
}

function logAutopilotStageFailure(stage: AutopilotStage, platform: string | undefined, error: unknown) {
  const value = error && typeof error === "object" ? error as { code?: unknown; message?: unknown } : {};
  console.error("[marketing-autopilot]", { stage, platform: platform ?? null, providerCode: typeof value.code === "string" ? value.code : null, providerMessage: safeProviderError(error) });
}

function stageFailure(stage: AutopilotStage, message: string, partialAssets: PartialAsset[] = []) {
  return NextResponse.json({ error: `${stage}: ${message}`, code: stage, stage, partialAssets }, { status: 503 });
}

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json({ audiences, objectives, channels, pipeline: ["Analyzing product", "Creating product proof", "Developing campaign angle", "Generating creative directions", "Rendering assets", "Preparing campaign package"] });
}

async function captureMissingProof(featureSlug: string): Promise<{ proof: IntelligenceProof; assetId: string; assetName: string; role: string }> {
  const baseUrl = resolveMarketingCaptureBaseUrl();
  if (!baseUrl) throw new Error("Marketing capture is not configured. Set MARKETING_CAPTURE_BASE_URL for production or use the current Vercel Preview URL.");
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
  } catch (error) {
    throw new Error(`BROWSER_MODULE_UNAVAILABLE: ${error instanceof Error ? error.message : "Browser capture modules could not be loaded."}`);
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
    if (captureError instanceof Error) {
      const code = typeof (captureError as unknown as { code?: unknown }).code === "string" ? (captureError as unknown as { code: string }).code : "CAPTURE_FAILED";
      throw new Error(`${code}: ${captureError.message}`);
    }
    throw new Error("CAPTURE_FAILED: Canonical product capture did not return an image.");
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
    let rendered;
    try {
      rendered = await renderAutopilotVariants(packageData, Buffer.from(await proofDownload.data.arrayBuffer()));
    } catch (error) {
      logAutopilotStageFailure("CREATIVE_RENDER_FAILED", undefined, error);
      return stageFailure("CREATIVE_RENDER_FAILED", "Creative variants could not be rendered.");
    }
    const renderBatch = randomUUID();
    const partialAssets: PartialAsset[] = [];
    const renderedVariants: Array<{ platform: RenderedAutopilotVariant["platform"]; width: number; height: number; filename: string; assetId: string; previewUrl: string | null }> = [];
    const previewFailures: Array<{ platform: string; assetId: string; code: "CREATIVE_PREVIEW_URL_FAILED" }> = [];
    for (const variant of rendered) {
      const storagePath = `autopilot/${renderBatch}/${variant.filename}`;
      partialAssets.push({ platform: variant.platform, status: "rendered" });
      const upload = await admin.storage.from("marketing-assets").upload(storagePath, variant.png, { contentType: "image/png", upsert: false });
      if (upload.error) {
        logAutopilotStageFailure("CREATIVE_UPLOAD_FAILED", variant.platform, upload.error);
        partialAssets[partialAssets.length - 1] = { platform: variant.platform, status: "failed", errorCode: "CREATIVE_UPLOAD_FAILED" };
        return stageFailure("CREATIVE_UPLOAD_FAILED", "Rendered creative could not be uploaded.", partialAssets);
      }
      partialAssets[partialAssets.length - 1] = { platform: variant.platform, status: "uploaded" };
      const metadata = await admin.from("marketing_assets").insert({ name: variant.filename.replace(/\.png$/, ""), asset_type: "social_export", storage_path: storagePath, mime_type: "image/png", width: variant.width, height: variant.height, feature_ids: [packageData.feature.id], tags: [`platform:${variant.platform}`, "source:marketing_autopilot"], approved_for_marketing: false, approval_status: "draft", source: "marketing_autopilot_render", marketing_use_approved: false, product_display_allowed: false, created_by: actor.user.id }).select("id,name,storage_path,width,height,approval_status").single();
      if (metadata.error || !metadata.data) {
        logAutopilotStageFailure("CREATIVE_REGISTRATION_FAILED", variant.platform, metadata.error);
        partialAssets[partialAssets.length - 1] = { platform: variant.platform, status: "failed", errorCode: "CREATIVE_REGISTRATION_FAILED" };
        return stageFailure("CREATIVE_REGISTRATION_FAILED", "Rendered creative metadata could not be registered.", partialAssets);
      }
      partialAssets[partialAssets.length - 1] = { platform: variant.platform, assetId: metadata.data.id, status: "registered" };
      let previewUrl: string | null = null;
      try {
        const signed = await admin.storage.from("marketing-assets").createSignedUrl(storagePath, 600);
        if (signed.error || !signed.data?.signedUrl) {
          logAutopilotStageFailure("CREATIVE_PREVIEW_URL_FAILED", variant.platform, signed.error);
          previewFailures.push({ platform: variant.platform, assetId: metadata.data.id, code: "CREATIVE_PREVIEW_URL_FAILED" });
        } else previewUrl = signed.data.signedUrl;
      } catch (error) {
        logAutopilotStageFailure("CREATIVE_PREVIEW_URL_FAILED", variant.platform, error);
        previewFailures.push({ platform: variant.platform, assetId: metadata.data.id, code: "CREATIVE_PREVIEW_URL_FAILED" });
      }
      renderedVariants.push({ platform: variant.platform, width: variant.width, height: variant.height, filename: variant.filename, assetId: metadata.data.id, previewUrl });
    }
    const diagnostics = { previewFailures, stages: ["Product proof", "Square render", "Portrait render", "Story render", "Asset registration", ...(previewFailures.length ? ["Preview URL"] : [])] };
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
    if (campaign.error || !campaign.data) {
      logAutopilotStageFailure("CAMPAIGN_PERSISTENCE_FAILED", undefined, campaign.error);
      return stageFailure("CAMPAIGN_PERSISTENCE_FAILED", "Campaign package could not be stored.", partialAssets);
    }

    const brief = await admin.from("marketing_creative_briefs").insert({
      campaign_id: campaign.data.id,
      brief: packageData,
      created_by: actor.user.id,
    }).select("id,status").single();
    if (brief.error || !brief.data) {
      logAutopilotStageFailure("CAMPAIGN_PERSISTENCE_FAILED", undefined, brief.error);
      return stageFailure("CAMPAIGN_PERSISTENCE_FAILED", "Campaign was created, but its brief could not be stored.", partialAssets);
    }

    return NextResponse.json({
      campaign: campaign.data,
      brief: brief.data,
      package: packageData,
      links: {
        review: `/dashboard/admin/marketing/campaigns/${campaign.data.id}`,
        creativeStudio: `/dashboard/admin/marketing/creative-studio?campaign=${campaign.data.id}`,
      },
      capture,
      diagnostics,
      autonomousActions: packageData.autonomousActions,
    }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Marketing Autopilot could not build this package." }, { status: 409 });
  }
}
