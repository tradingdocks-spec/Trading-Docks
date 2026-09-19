import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const APPROVAL_STATES = new Set(["draft", "approved", "restricted", "archived"]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Asset update is required." }, { status: 400 });
  const approvalStatus = typeof body.approvalStatus === "string" ? body.approvalStatus : undefined;
  if (approvalStatus && !APPROVAL_STATES.has(approvalStatus)) return NextResponse.json({ error: "Unsupported approval state." }, { status: 400 });
  if (approvalStatus === "approved" && body.marketingUseApproved !== true) return NextResponse.json({ error: "Marketing approval requires confirmed commercial-use approval." }, { status: 400 });
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const [input, column] of [["name", "name"], ["altText", "alt_text"], ["source", "source"], ["sourceUrl", "source_url"], ["licenseNotes", "license_notes"]] as const) if (typeof body[input] === "string") updates[column] = body[input].slice(0, input === "licenseNotes" ? 2000 : 500);
  if (Array.isArray(body.tags)) updates.tags = body.tags.filter((value): value is string => typeof value === "string").slice(0, 30);
  for (const [input, column] of [["brandRole", "brand_role"], ["screenshotRole", "screenshot_role"]] as const) if (typeof body[input] === "string") updates[column] = body[input].slice(0, 80);
  for (const [input, column] of [["focalX", "focal_x"], ["focalY", "focal_y"]] as const) if (typeof body[input] === "number") updates[column] = Math.max(0, Math.min(1, body[input]));
  if (typeof body.safeCrop === "boolean") updates.safe_crop = body.safeCrop;
  if (Array.isArray(body.preferredAspectRatios)) updates.preferred_aspect_ratios = body.preferredAspectRatios.filter((value): value is string => typeof value === "string").slice(0, 12);
  if (approvalStatus) { updates.approval_status = approvalStatus; updates.approved_for_marketing = approvalStatus === "approved"; updates.archived_at = approvalStatus === "archived" ? new Date().toISOString() : null; }
  if (typeof body.marketingUseApproved === "boolean") updates.marketing_use_approved = body.marketingUseApproved;
  const admin = createAdminClient();
  const { data, error } = await admin.from("marketing_assets").update(updates).eq("id", id).select("id,name,asset_type,width,height,tags,approval_status,source,source_url,license_notes,alt_text,marketing_use_approved,brand_role,screenshot_role,focal_x,focal_y,safe_crop,preferred_aspect_ratios,archived_at,updated_at").single();
  if (error || !data) return NextResponse.json({ error: "Asset could not be updated." }, { status: 503 });
  return NextResponse.json({ asset: data, updatedBy: actor.user.id });
}
