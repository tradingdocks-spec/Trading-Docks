import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const REJECTION_REASONS = new Set(["copy", "visual hierarchy", "brand mismatch", "incorrect claim", "wrong asset", "wrong audience", "cropping", "other"]);

async function loadCreative(id: string) {
  return createAdminClient().from("marketing_creatives").select("id,campaign_id,brief_id,name,status,platform,variant_key,width,height,copy_payload,render_spec,quality_issues,quality_review,brand_signature,brand_profile_version,concept_direction,campaign_visual_family_id,asset_ids,parent_creative_id,variant_group_id,created_at,marketing_creative_briefs(prospect_id,brief)").eq("id", id).maybeSingle();
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const result = await loadCreative(id);
  if (result.error || !result.data) return NextResponse.json({ error: "Creative not found." }, { status: 404 });
  return NextResponse.json({ creative: result.data });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { action?: string; rejectionReason?: string; rejectionNotes?: string } | null;
  const result = await loadCreative(id);
  if (result.error || !result.data) return NextResponse.json({ error: "Creative not found." }, { status: 404 });
  const creative = result.data as Record<string, unknown>;
  const action = body?.action;
  if (action === "mark_gold_standard" || action === "remove_gold_standard") {
    if (creative.status !== "approved" && action === "mark_gold_standard") return NextResponse.json({ error: "Only approved creatives can enter the Gold Standard Library." }, { status: 409 });
    const savedGold = await createAdminClient().from("marketing_creatives").update({ gold_standard: action === "mark_gold_standard", updated_at: new Date().toISOString() }).eq("id", id).select("id,status,gold_standard").single();
    if (savedGold.error || !savedGold.data) return NextResponse.json({ error: "Gold Standard state could not be updated. Apply the documented additive migration first." }, { status: 503 });
    return NextResponse.json({ creative: savedGold.data });
  }
  let status: string;
  if (action === "review") status = "review";
  else if (action === "approve") status = "approved";
  else if (action === "reject") status = "rejected";
  else if (action === "archive") status = "archived";
  else return NextResponse.json({ error: "Unsupported creative action." }, { status: 400 });
  if (status === "approved") {
    const assetIds = Array.isArray(creative.asset_ids) ? creative.asset_ids.filter((value): value is string => typeof value === "string") : [];
    const issues = Array.isArray(creative.quality_issues) ? creative.quality_issues : [];
    if (issues.length) return NextResponse.json({ error: "Resolve deterministic render quality issues before approval.", qualityIssues: issues }, { status: 409 });
    const brandReview = Array.isArray(creative.quality_review) ? creative.quality_review as Array<{ status?: string; blocking?: boolean }> : [];
    if (brandReview.some((check) => check.status === "fail" && check.blocking !== false)) return NextResponse.json({ error: "Resolve blocking Brand System quality checks before approval.", qualityReview: brandReview }, { status: 409 });
    if (assetIds.length) {
      const approved = await createAdminClient().from("marketing_assets").select("id").in("id", assetIds).eq("approval_status", "approved").eq("marketing_use_approved", true).is("archived_at", null);
      if (approved.error || (approved.data ?? []).length !== assetIds.length) return NextResponse.json({ error: "Every source asset must be approved for marketing and not archived." }, { status: 409 });
    }
  }
  if (status === "rejected" && body?.rejectionReason && !REJECTION_REASONS.has(body.rejectionReason)) return NextResponse.json({ error: "Unsupported rejection reason." }, { status: 400 });
  const admin = createAdminClient();
  const updates: Record<string, unknown> = { status, reviewed_by: actor.user.id, reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() };
  if (status === "approved") { updates.approved_by = actor.user.id; updates.approved_at = new Date().toISOString(); updates.rejected_by = null; updates.rejected_at = null; }
  if (status === "rejected") { updates.rejected_by = actor.user.id; updates.rejected_at = new Date().toISOString(); updates.rejection_reason = body?.rejectionReason ?? "other"; updates.rejection_notes = body?.rejectionNotes?.slice(0, 2000) ?? null; }
  if (status === "archived") updates.archived_at = new Date().toISOString();
  const saved = await admin.from("marketing_creatives").update(updates).eq("id", id).select("id,status,reviewed_at,approved_at,rejected_at,rejection_reason,rejection_notes").single();
  if (saved.error || !saved.data) return NextResponse.json({ error: "Creative status could not be updated." }, { status: 503 });
  if (typeof creative.campaign_id === "string") await admin.from("marketing_campaign_activities").insert({ campaign_id: creative.campaign_id, actor_user_id: actor.user.id, activity_type: `creative_${status === "review" ? "sent_to_review" : status}`, body: `Creative ${status === "review" ? "sent to review" : `${status}`}.`, metadata: { creativeId: id } });
  return NextResponse.json({ creative: saved.data });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as { action?: string } | null;
  if (!body || !["duplicate", "variant"].includes(body.action ?? "")) return NextResponse.json({ error: "A duplicate or variant action is required." }, { status: 400 });
  const result = await loadCreative(id);
  if (result.error || !result.data) return NextResponse.json({ error: "Creative not found." }, { status: 404 });
  const original = result.data as Record<string, unknown>;
  const admin = createAdminClient();
  const group = typeof original.variant_group_id === "string" ? original.variant_group_id : randomUUID();
  const copy = await admin.from("marketing_creatives").insert({ campaign_id: original.campaign_id, brief_id: original.brief_id, name: `${String(original.name)} · ${body.action === "variant" ? "Variant" : "Copy"}`, composition_family: original.render_spec && typeof original.render_spec === "object" && "composition" in original.render_spec ? (original.render_spec as { composition: string }).composition : "product_hero", platform: original.platform, variant_key: `${String(original.variant_key)}-${body.action === "variant" ? "V" : "C"}`, status: "draft", copy_payload: original.copy_payload, asset_ids: original.asset_ids, render_spec: original.render_spec, width: original.width, height: original.height, quality_issues: original.quality_issues, quality_review: original.quality_review, brand_signature: original.brand_signature, brand_profile_version: original.brand_profile_version ?? 1, concept_direction: original.concept_direction, campaign_visual_family_id: original.campaign_visual_family_id, parent_creative_id: id, variant_group_id: group, created_by: actor.user.id }).select("id,name,status,platform,variant_key,parent_creative_id,variant_group_id").single();
  if (copy.error || !copy.data) return NextResponse.json({ error: "Creative copy could not be created." }, { status: 503 });
  if (typeof original.campaign_id === "string") await admin.from("marketing_campaign_activities").insert({ campaign_id: original.campaign_id, actor_user_id: actor.user.id, activity_type: `creative_${body.action}d`, body: `Created a creative ${body.action}.`, metadata: { creativeId: copy.data.id, parentCreativeId: id } });
  return NextResponse.json({ creative: copy.data }, { status: 201 });
}
