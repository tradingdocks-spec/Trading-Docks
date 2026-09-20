import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { buildCampaignDraftPlan, rankMarketingOpportunities, type IntelligenceInput, type IntelligenceProof } from "@/lib/marketing/marketing-intelligence";
import { MARKETING_PRODUCT_REGISTRY, mergeApprovedFeatureMetadata } from "@/lib/marketing/product-marketing-registry";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const INPUT_VALUES = {
  audiences: ["local_game_store", "multi_location_store", "high_volume_online_seller"],
  objectives: ["awareness", "workflow_education", "demo_request"],
  channels: ["instagram", "email", "facebook", "website"],
} as const;

async function loadContext() {
  const admin = createAdminClient();
  const [featuresResult, assetsResult, campaignsResult, goldResult] = await Promise.all([
    admin.from("marketing_feature_library").select("id,slug,name,target_audiences,problems_solved,capabilities,approved_claims,disallowed_claims,landing_url").eq("status", "active"),
    admin.from("marketing_assets").select("id,name,feature_ids,screenshot_role,source,approval_status,marketing_use_approved,archived_at,storage_path").in("asset_type", ["product_screenshot", "feature_screenshot"]).eq("approval_status", "approved").eq("marketing_use_approved", true).is("archived_at", null).limit(300),
    admin.from("marketing_outbound_campaigns").select("id,feature_id,audience,created_at").order("created_at", { ascending: false }).limit(200),
    admin.from("marketing_creatives").select("campaign_id,platform,composition_family").eq("gold_standard", true).eq("status", "approved").limit(100),
  ]);
  const failed = [featuresResult, assetsResult, campaignsResult, goldResult].find((result) => result.error);
  if (failed?.error) throw new Error("Marketing intelligence data could not be loaded.");
  const features = MARKETING_PRODUCT_REGISTRY.map((registryFeature) => {
    const metadata = (featuresResult.data ?? []).find((item) => item.slug === registryFeature.slug);
    return mergeApprovedFeatureMetadata(registryFeature, metadata as Record<string, unknown> | undefined);
  });
  const proofs: IntelligenceProof[] = await Promise.all((assetsResult.data ?? []).map(async (asset) => {
    const signed = typeof asset.storage_path === "string" && !asset.storage_path.startsWith("/") ? await admin.storage.from("marketing-assets").createSignedUrl(asset.storage_path, 600) : null;
    return { id: asset.id, name: asset.name, featureIds: asset.feature_ids ?? [], role: asset.screenshot_role, source: asset.source, approved: asset.approval_status === "approved", marketingApproved: asset.marketing_use_approved === true, archived: Boolean(asset.archived_at), signedUrl: signed?.data?.signedUrl ?? (asset.storage_path?.startsWith("/") ? asset.storage_path : null) };
  }));
  const campaigns = (campaignsResult.data ?? []).map((campaign) => ({ featureId: campaign.feature_id, audience: campaign.audience, createdAt: campaign.created_at }));
  const goldStandards = (goldResult.data ?? []).map((creative) => ({ featureId: campaignsResult.data?.find((campaign) => campaign.id === creative.campaign_id)?.feature_id ?? null, platform: creative.platform, composition: creative.composition_family }));
  return { features, proofs, campaigns, goldStandards };
}

export async function GET() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  return NextResponse.json({ audiences: INPUT_VALUES.audiences, objectives: INPUT_VALUES.objectives, channels: INPUT_VALUES.channels, dataSource: "Approved product metadata + synthetic demo state" });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Partial<IntelligenceInput> & { action?: string; featureSlug?: string } | null;
  const input: IntelligenceInput = { audience: typeof body?.audience === "string" && INPUT_VALUES.audiences.includes(body.audience as typeof INPUT_VALUES.audiences[number]) ? body.audience : "local_game_store", objective: typeof body?.objective === "string" && INPUT_VALUES.objectives.includes(body.objective as typeof INPUT_VALUES.objectives[number]) ? body.objective : "awareness", channel: typeof body?.channel === "string" && INPUT_VALUES.channels.includes(body.channel as typeof INPUT_VALUES.channels[number]) ? body.channel : "instagram" };
  try {
    const context = await loadContext();
    const opportunities = rankMarketingOpportunities(context.features, context.proofs, context.campaigns, context.goldStandards, input);
    if (body?.action !== "build_campaign") return NextResponse.json({ input, opportunities, dataSource: "Approved product metadata + synthetic demo state", autonomousActions: [] });
    const chosen = opportunities.find((item) => item.feature.slug === body.featureSlug) ?? opportunities[0];
    if (!chosen) return NextResponse.json({ error: "No approved product opportunity is ready for this audience and objective." }, { status: 409 });
    const plan = buildCampaignDraftPlan(chosen, input);
    const admin = createAdminClient();
    const campaign = await admin.from("marketing_outbound_campaigns").insert({ name: `${chosen.feature.name} · ${input.objective}`, feature_id: chosen.feature.id, audience: input.audience, objective: input.objective, cta: chosen.suggestedCta, landing_url: chosen.feature.landingUrl, creative_brief: plan, created_by: actor.user.id }).select("id,name,status,feature_id,audience,objective,cta,landing_url").single();
    if (campaign.error || !campaign.data) return NextResponse.json({ error: "Campaign draft could not be created." }, { status: 503 });
    const brief = await admin.from("marketing_creative_briefs").insert({ campaign_id: campaign.data.id, brief: plan, created_by: actor.user.id }).select("id,status").single();
    if (brief.error) return NextResponse.json({ error: "Campaign draft was created, but its creative plan could not be saved." }, { status: 503 });
    return NextResponse.json({ campaign: campaign.data, brief: brief.data, plan, links: { campaignReview: `/dashboard/admin/marketing/campaigns/${campaign.data.id}`, creativeStudio: `/dashboard/admin/marketing/creative-studio?campaign=${campaign.data.id}` }, next: `/dashboard/admin/marketing/campaigns/${campaign.data.id}`, publishing: "not performed", sending: "not performed" }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Marketing intelligence is not initialized. Apply the documented marketing foundation first." }, { status: 503 });
  }
}
