import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { buildRenderSpec, renderCreativeSvg, validateRenderSpec, type CreativeRenderSpec } from "@/lib/marketing/creative-renderer";
import { runBrandQualityChecks, validateCreativeCopy } from "@/lib/marketing/brand-system";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; spec?: Partial<CreativeRenderSpec>; campaignId?: string; featureId?: string; briefId?: string; creativeId?: string; assetIds?: string[]; conceptDirection?: "product" | "transformation" | "editorial"; campaignVisualFamilyId?: string; brandProfileVersion?: number } | null;
  if (!body?.spec || typeof body.spec.featureName !== "string" || typeof body.spec.headline !== "string" || typeof body.spec.subheadline !== "string" || typeof body.spec.cta !== "string") return NextResponse.json({ error: "A complete render specification is required." }, { status: 400 });
  const spec = buildRenderSpec(body.spec as Partial<CreativeRenderSpec> & Pick<CreativeRenderSpec, "featureName" | "headline" | "subheadline" | "cta">);
  const qualityIssues = validateRenderSpec(spec);
  if (body.action === "preview" || !body.action) return new NextResponse(renderCreativeSvg(spec), { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" } });
  if (body.action !== "save") return NextResponse.json({ error: "Unsupported renderer action." }, { status: 400 });
  if (!body.campaignId || !body.featureId) return NextResponse.json({ error: "A campaign and feature are required to save a creative." }, { status: 400 });
  const admin = createAdminClient();
  const feature = await admin.from("marketing_feature_library").select("id,name,approved_claims,disallowed_claims").eq("id", body.featureId).maybeSingle();
  if (feature.error || !feature.data) return NextResponse.json({ error: "The selected feature could not be verified." }, { status: 400 });
  const selectedAssets = body.assetIds?.length ? await admin.from("marketing_assets").select("id,asset_type,brand_role,approval_status,marketing_use_approved,archived_at,feature_ids,screenshot_role").in("id", body.assetIds) : { data: [], error: null };
  if (selectedAssets.error || (selectedAssets.data ?? []).length !== (body.assetIds ?? []).length) return NextResponse.json({ error: "Every selected asset must be approved for marketing and not archived." }, { status: 400 });
  if ((selectedAssets.data ?? []).some((asset) => asset.approval_status !== "approved" || asset.marketing_use_approved !== true || asset.archived_at)) return NextResponse.json({ error: "Every selected asset must be approved for marketing and not archived." }, { status: 400 });
  if (feature.data.name === "Chaos Sort" && (selectedAssets.data ?? []).some((asset) => ["product_screenshot", "feature_screenshot"].includes(asset.asset_type) && (!Array.isArray(asset.feature_ids) || !asset.feature_ids.includes(body.featureId)))) return NextResponse.json({ error: "Chaos Sort creatives require an approved Chaos Sort screenshot." }, { status: 400 });
  const logoAssetApproved = (selectedAssets.data ?? []).some((asset) => asset.asset_type === "logo" && asset.marketing_use_approved === true && asset.brand_role);
  const productAssetApproved = (selectedAssets.data ?? []).some((asset) => ["product_screenshot", "feature_screenshot"].includes(asset.asset_type) && asset.marketing_use_approved === true);
  const claims = (value: unknown) => Array.isArray(value) ? value.flatMap((item) => item && typeof item === "object" && "claim" in item && typeof item.claim === "string" ? [item.claim] : typeof item === "string" ? [item] : []) : [];
  const claimsApproved = validateCreativeCopy(`${spec.headline}\n${spec.subheadline}`, claims(feature.data.approved_claims), claims(feature.data.disallowed_claims));
  const qualityReview = runBrandQualityChecks({ headline: spec.headline, subheadline: spec.subheadline, cta: spec.cta, platform: spec.platform, productAssetApproved, logoAssetApproved, hasFeatureCopy: Boolean(spec.featureName.trim()), claimsApproved, hasOverflow: false });
  const brandSignature = { elements: qualityReview.filter((check) => check.status === "pass").map((check) => check.key), conceptDirection: body.conceptDirection ?? spec.conceptDirection ?? null };
  let visualFamilyId = body.campaignVisualFamilyId ?? null;
  if (!visualFamilyId && body.conceptDirection) {
    const family = await admin.from("marketing_campaign_visual_families").insert({ campaign_id: body.campaignId, feature_id: body.featureId, name: `${spec.featureName} · ${body.conceptDirection}`, concept_id: body.conceptDirection, concept_payload: { headline: spec.headline, composition: spec.composition }, brand_profile_version: body.brandProfileVersion ?? 1, created_by: actor.user.id }).select("id").single();
    if (family.error || !family.data) return NextResponse.json({ error: "Campaign visual family could not be created. Apply the documented additive migration first." }, { status: 503 });
    visualFamilyId = family.data.id;
  }
  const { data, error } = await admin.from("marketing_creatives").insert({ campaign_id: body.campaignId, brief_id: body.briefId ?? null, name: `${spec.featureName} · ${spec.platform}`, composition_family: spec.composition, platform: spec.platform, variant_key: body.creativeId ? `variant-${Date.now()}` : "A", copy_payload: { headline: spec.headline, subheadline: spec.subheadline, cta: spec.cta }, asset_ids: body.assetIds ?? [], render_spec: spec, width: spec.width, height: spec.height, quality_issues: qualityIssues, concept_direction: body.conceptDirection ?? spec.conceptDirection ?? null, campaign_visual_family_id: visualFamilyId, brand_profile_version: body.brandProfileVersion ?? 1, brand_signature: brandSignature, quality_review: qualityReview, created_by: actor.user.id }).select("id,name,status,platform,width,height,quality_issues,quality_review,brand_signature,render_spec,asset_ids,created_at").single();
  if (error || !data) return NextResponse.json({ error: "Creative could not be saved. Apply the renderer migration in staging first." }, { status: 503 });
  return NextResponse.json({ creative: data, qualityIssues, svg: renderCreativeSvg(spec) }, { status: 201 });
}
