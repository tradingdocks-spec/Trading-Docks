import { createAdminClient } from "@/lib/supabase/admin";
import type { CanonicalCaptureMetadata } from "./canonical-capture";

export async function registerCanonicalCapture(metadata: CanonicalCaptureMetadata, png: Buffer) {
  const admin = createAdminClient();
  const uploaded = await admin.storage.from("marketing-assets").upload(metadata.storagePath, png, { contentType: "image/png", upsert: true });
  if (uploaded.error) throw new Error("Canonical PNG could not be stored.");
  const asset = await admin.from("marketing_assets").upsert({ name: metadata.name, slug: metadata.slug, asset_type: metadata.assetType, storage_path: metadata.storagePath, mime_type: "image/png", width: metadata.width, height: metadata.height, feature_ids: metadata.featureIds, approval_status: "approved", approved_for_marketing: true, marketing_use_approved: true, source: metadata.source, tags: [`capture_version:${metadata.captureVersion}`, `screenshot_role:${metadata.screenshotRole}`, "safe_crop:true"] }, { onConflict: "slug" }).select("id,name,asset_type,storage_path,approval_status,marketing_use_approved").single();
  if (asset.error || !asset.data) throw new Error("Canonical asset metadata could not be registered.");
  return asset.data;
}

export async function resolveCanonicalFeatureId(slug: string) {
  const admin = createAdminClient();
  const feature = await admin.from("marketing_feature_library").select("id").eq("slug", slug).maybeSingle();
  return feature.data?.id ?? null;
}
