import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { REPO_BRAND_ASSET_MANIFEST, repoBrandAssetRow } from "@/lib/marketing/repo-brand-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function POST() {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const admin = createAdminClient();
  let created = 0;
  let updated = 0;
  const assets: Array<Record<string, unknown>> = [];
  for (const manifest of REPO_BRAND_ASSET_MANIFEST) {
    const existing = await admin.from("marketing_assets").select("id").or(`slug.eq.${manifest.slug},name.eq.${manifest.name}`).limit(1).maybeSingle();
    if (existing.error) return NextResponse.json({ error: "Built-in brand assets could not be checked." }, { status: 503 });
    const row = repoBrandAssetRow(manifest, actor.user.id);
    const { created_by: _createdBy, ...updateRow } = row;
    const result = existing.data?.id
      ? await admin.from("marketing_assets").update({ ...updateRow, updated_at: new Date().toISOString() }).eq("id", existing.data.id).select("id,name,storage_path,asset_type,brand_role,approval_status").single()
      : await admin.from("marketing_assets").insert(row).select("id,name,storage_path,asset_type,brand_role,approval_status").single();
    if (result.error || !result.data) return NextResponse.json({ error: "Built-in brand assets could not be registered. Apply the documented Asset Vault migration first." }, { status: 503 });
    if (existing.data?.id) updated += 1; else created += 1;
    assets.push(result.data as Record<string, unknown>);
  }
  return NextResponse.json({ created, updated, total: assets.length, assets, message: `Registered ${assets.length} Trading Docks brand assets (${created} created, ${updated} updated).` });
}
