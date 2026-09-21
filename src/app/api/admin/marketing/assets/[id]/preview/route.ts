import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const { id } = await context.params;
  const admin = createAdminClient();
  const asset = await admin.from("marketing_assets").select("id,storage_path").eq("id", id).maybeSingle();
  if (asset.error || !asset.data?.storage_path) return NextResponse.json({ error: "Asset preview is unavailable." }, { status: 404 });
  if (asset.data.storage_path.startsWith("/")) return NextResponse.json({ assetId: asset.data.id, previewUrl: asset.data.storage_path });
  const signed = await admin.storage.from("marketing-assets").createSignedUrl(asset.data.storage_path, 600);
  if (signed.error || !signed.data?.signedUrl) return NextResponse.json({ error: "Asset preview is temporarily unavailable." }, { status: 503 });
  return NextResponse.json({ assetId: asset.data.id, previewUrl: signed.data.signedUrl });
}
