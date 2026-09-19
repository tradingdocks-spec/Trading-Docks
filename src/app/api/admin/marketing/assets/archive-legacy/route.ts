import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { isRedundantLegacyBrandAsset } from "@/lib/marketing/repo-brand-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const admin = createAdminClient();
  const candidates = await admin.from("marketing_assets").select("id,name,slug,asset_type,approval_status,source,brand_role,archived_at").eq("asset_type", "icon").eq("approval_status", "draft").is("archived_at", null);
  if (candidates.error) return NextResponse.json({ error: "Legacy brand assets could not be checked." }, { status: 503 });
  const legacy = (candidates.data ?? []).filter((asset) => isRedundantLegacyBrandAsset({ name: asset.name, slug: asset.slug, assetType: asset.asset_type, approvalStatus: asset.approval_status, source: asset.source, brandRole: asset.brand_role }));
  if (!legacy.length) return NextResponse.json({ archived: 0, assets: [], message: "No redundant legacy brand assets needed archiving." });
  const ids = legacy.map((asset) => asset.id);
  const archivedAt = new Date().toISOString();
  const result = await admin.from("marketing_assets").update({ approval_status: "archived", approved_for_marketing: false, archived_at: archivedAt, updated_at: archivedAt }).in("id", ids).is("archived_at", null).select("id,name,storage_path,approval_status,archived_at");
  if (result.error) return NextResponse.json({ error: "Redundant legacy brand assets could not be archived." }, { status: 503 });
  return NextResponse.json({ archived: result.data?.length ?? 0, assets: result.data ?? [], message: `Archived ${result.data?.length ?? 0} redundant legacy brand assets. Storage files were not deleted.`, updatedBy: actor.user.id });
}
