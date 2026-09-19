import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { CAMPAIGN_PLACEMENTS, validatePlacement } from "@/lib/marketing/campaign-workflow";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const [campaign, placements, activities, availableCreatives] = await Promise.all([
    admin.from("marketing_outbound_campaigns").select("id,name,status,audience,objective,cta,landing_url,created_at,updated_at,feature_id,marketing_feature_library(id,name,customer_description,approved_claims)").eq("id", id).maybeSingle(),
    admin.from("marketing_campaign_creatives").select("campaign_id,creative_id,placement,attached_by,attached_at,marketing_creatives(id,name,status,platform,variant_key,width,height,copy_payload,render_spec,quality_issues,asset_ids,created_at,marketing_assets(id,name,asset_type,approval_status,marketing_use_approved))").eq("campaign_id", id).order("placement"),
    admin.from("marketing_campaign_activities").select("id,activity_type,body,metadata,created_at").eq("campaign_id", id).order("created_at", { ascending: false }).limit(100),
    admin.from("marketing_creatives").select("id,name,status,platform,variant_key,width,height,render_spec,asset_ids,quality_issues").eq("status", "approved").order("updated_at", { ascending: false }).limit(200),
  ]);
  if (campaign.error || !campaign.data) return NextResponse.json({ error: "Campaign could not be loaded." }, { status: 404 });
  return NextResponse.json({ campaign: campaign.data, placements: placements.data ?? [], activities: activities.data ?? [], availableCreatives: availableCreatives.data ?? [], placementOptions: CAMPAIGN_PLACEMENTS });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { action?: string; creativeId?: string; placement?: string } | null;
  if (body?.action !== "attach" || !body.creativeId || !body.placement) return NextResponse.json({ error: "Creative and placement are required." }, { status: 400 });
  const admin = createAdminClient();
  const creative = await admin.from("marketing_creatives").select("id,status,platform,width,height").eq("id", body.creativeId).maybeSingle();
  if (creative.error || !creative.data) return NextResponse.json({ error: "Creative not found." }, { status: 404 });
  const validation = validatePlacement(body.placement, creative.data);
  if (validation) return NextResponse.json({ error: validation }, { status: 409 });
  const attached = await admin.from("marketing_campaign_creatives").upsert({ campaign_id: id, creative_id: body.creativeId, placement: body.placement, attached_by: actor.user.id, attached_at: new Date().toISOString() }, { onConflict: "campaign_id,placement" }).select("campaign_id,creative_id,placement,attached_at").single();
  if (attached.error || !attached.data) return NextResponse.json({ error: "Creative could not be attached." }, { status: 503 });
  await Promise.all([
    admin.from("marketing_campaign_activities").insert({ campaign_id: id, actor_user_id: actor.user.id, activity_type: "creative_attached", body: `Attached approved creative to ${body.placement}.`, metadata: { creativeId: body.creativeId, placement: body.placement } }),
  ]);
  return NextResponse.json({ placement: attached.data }, { status: 201 });
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const placement = new URL(request.url).searchParams.get("placement");
  if (!placement) return NextResponse.json({ error: "Placement is required." }, { status: 400 });
  const admin = createAdminClient();
  const removed = await admin.from("marketing_campaign_creatives").delete().eq("campaign_id", id).eq("placement", placement);
  if (removed.error) return NextResponse.json({ error: "Creative placement could not be removed." }, { status: 503 });
  await admin.from("marketing_campaign_activities").insert({ campaign_id: id, actor_user_id: actor.user.id, activity_type: "creative_removed", body: `Removed creative from ${placement}.`, metadata: { placement } });
  return NextResponse.json({ removed: true });
}
