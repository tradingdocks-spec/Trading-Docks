import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { buildRenderSpec, renderCreativeSvg, validateRenderSpec, type CreativeRenderSpec } from "@/lib/marketing/creative-renderer";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as { action?: string; spec?: Partial<CreativeRenderSpec>; campaignId?: string; briefId?: string; creativeId?: string; assetIds?: string[] } | null;
  if (!body?.spec || typeof body.spec.featureName !== "string" || typeof body.spec.headline !== "string" || typeof body.spec.subheadline !== "string" || typeof body.spec.cta !== "string") return NextResponse.json({ error: "A complete render specification is required." }, { status: 400 });
  const spec = buildRenderSpec(body.spec as Partial<CreativeRenderSpec> & Pick<CreativeRenderSpec, "featureName" | "headline" | "subheadline" | "cta">);
  const qualityIssues = validateRenderSpec(spec);
  if (body.action === "preview" || !body.action) return new NextResponse(renderCreativeSvg(spec), { headers: { "Content-Type": "image/svg+xml; charset=utf-8", "Cache-Control": "no-store" } });
  if (body.action !== "save") return NextResponse.json({ error: "Unsupported renderer action." }, { status: 400 });
  if (!body.campaignId) return NextResponse.json({ error: "A campaign is required to save a creative." }, { status: 400 });
  const admin = createAdminClient();
  if (body.assetIds?.length) {
    const approved = await admin.from("marketing_assets").select("id").in("id", body.assetIds).eq("approval_status", "approved").eq("marketing_use_approved", true).is("archived_at", null);
    if (approved.error || (approved.data ?? []).length !== body.assetIds.length) return NextResponse.json({ error: "Every selected asset must be approved for marketing and not archived." }, { status: 400 });
  }
  const { data, error } = await admin.from("marketing_creatives").insert({ campaign_id: body.campaignId, brief_id: body.briefId ?? null, name: `${spec.featureName} · ${spec.platform}`, composition_family: spec.composition, platform: spec.platform, variant_key: body.creativeId ? `variant-${Date.now()}` : "A", copy_payload: { headline: spec.headline, subheadline: spec.subheadline, cta: spec.cta }, asset_ids: body.assetIds ?? [], render_spec: spec, width: spec.width, height: spec.height, quality_issues: qualityIssues, created_by: actor.user.id }).select("id,name,status,platform,width,height,quality_issues,render_spec,asset_ids,created_at").single();
  if (error || !data) return NextResponse.json({ error: "Creative could not be saved. Apply the renderer migration in staging first." }, { status: 503 });
  return NextResponse.json({ creative: data, qualityIssues, svg: renderCreativeSvg(spec) }, { status: 201 });
}
