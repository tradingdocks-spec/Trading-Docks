import { createAdminClient } from "@/lib/supabase/admin";
import type { CanonicalCaptureMetadata } from "./canonical-capture";

type CanonicalAssetRow = {
  name: string;
  slug: string;
  asset_type: "product_screenshot";
  storage_path: string;
  mime_type: "image/png";
  width: number;
  height: number;
  feature_ids: string[];
  approval_status: "approved";
  approved_for_marketing: true;
  marketing_use_approved: true;
  source: "canonical_product_capture";
  screenshot_role: CanonicalCaptureMetadata["screenshotRole"];
  safe_crop: true;
  tags: string[];
};

export class CanonicalAssetRegistrationError extends Error {
  constructor(public readonly code: "ASSET_STORAGE_UPLOAD_FAILED" | "ASSET_REGISTRATION_FAILED", message: string) {
    super(message);
    this.name = "CanonicalAssetRegistrationError";
  }
}

function safeSupabaseError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return {
    code: typeof candidate?.code === "string" ? candidate.code.slice(0, 40) : "UNKNOWN",
    message: String(candidate?.message ?? "Unknown Supabase error.")
      .replace(/https?:\/\/\S+/gi, "[remote resource]")
      .replace(/service[_ -]?role|supabase[_ -]?key|authorization|bearer/gi, "[redacted]")
      .slice(0, 240),
  };
}

function logRegistrationFailure(stage: string, error: unknown) {
  console.error("[marketing-capture-registration]", { stage, ...safeSupabaseError(error) });
}

function isDuplicateSlugError(error: unknown) {
  const candidate = error as { code?: unknown; message?: unknown } | null;
  return candidate?.code === "23505" || /duplicate key|unique constraint|marketing_assets_slug/i.test(String(candidate?.message ?? ""));
}

function canonicalAssetRow(metadata: CanonicalCaptureMetadata): CanonicalAssetRow {
  return {
    name: metadata.name,
    slug: metadata.slug,
    asset_type: "product_screenshot",
    storage_path: metadata.storagePath,
    mime_type: "image/png",
    width: metadata.width,
    height: metadata.height,
    feature_ids: metadata.featureIds,
    approval_status: "approved",
    approved_for_marketing: true,
    marketing_use_approved: true,
    source: "canonical_product_capture",
    screenshot_role: metadata.screenshotRole,
    safe_crop: true,
    tags: [`capture_version:${metadata.captureVersion}`, `screenshot_role:${metadata.screenshotRole}`, "safe_crop:true"],
  };
}

export async function registerCanonicalCapture(metadata: CanonicalCaptureMetadata, png: Buffer) {
  const admin = createAdminClient();
  const uploaded = await admin.storage.from("marketing-assets").upload(metadata.storagePath, png, { contentType: "image/png", upsert: true });
  if (uploaded.error) {
    logRegistrationFailure("storage_upload", uploaded.error);
    throw new CanonicalAssetRegistrationError("ASSET_STORAGE_UPLOAD_FAILED", "Canonical PNG could not be stored.");
  }

  const row = canonicalAssetRow(metadata);
  const existing = await admin.from("marketing_assets").select("id").eq("slug", metadata.slug).maybeSingle();
  if (existing.error) {
    logRegistrationFailure("slug_lookup", existing.error);
    throw new CanonicalAssetRegistrationError("ASSET_REGISTRATION_FAILED", "Canonical asset metadata could not be registered.");
  }

  const select = "id,name,asset_type,storage_path,approval_status,marketing_use_approved,screenshot_role,safe_crop,feature_ids";
  if (existing.data?.id) {
    const updated = await admin.from("marketing_assets").update({ ...row, updated_at: new Date().toISOString() }).eq("id", existing.data.id).select(select).single();
    if (updated.error || !updated.data) {
      logRegistrationFailure("metadata_update", updated.error ?? new Error("Updated canonical asset was not returned."));
      throw new CanonicalAssetRegistrationError("ASSET_REGISTRATION_FAILED", "Canonical asset metadata could not be registered.");
    }
    return updated.data;
  }

  const inserted = await admin.from("marketing_assets").insert(row).select(select).single();
  if (!inserted.error && inserted.data) return inserted.data;
  if (!isDuplicateSlugError(inserted.error)) {
    logRegistrationFailure("metadata_insert", inserted.error ?? new Error("Inserted canonical asset was not returned."));
    throw new CanonicalAssetRegistrationError("ASSET_REGISTRATION_FAILED", "Canonical asset metadata could not be registered.");
  }

  const raced = await admin.from("marketing_assets").select("id").eq("slug", metadata.slug).maybeSingle();
  if (raced.error || !raced.data?.id) {
    logRegistrationFailure("duplicate_requery", raced.error ?? new Error("Concurrent canonical asset was not found."));
    throw new CanonicalAssetRegistrationError("ASSET_REGISTRATION_FAILED", "Canonical asset metadata could not be registered.");
  }
  const updated = await admin.from("marketing_assets").update({ ...row, updated_at: new Date().toISOString() }).eq("id", raced.data.id).select(select).single();
  if (updated.error || !updated.data) {
    logRegistrationFailure("duplicate_update", updated.error ?? new Error("Concurrent canonical asset update was not returned."));
    throw new CanonicalAssetRegistrationError("ASSET_REGISTRATION_FAILED", "Canonical asset metadata could not be registered.");
  }
  return updated.data;
}

export async function resolveCanonicalFeatureId(slug: string) {
  const admin = createAdminClient();
  const feature = await admin.from("marketing_feature_library").select("id").eq("slug", slug).maybeSingle();
  return feature.data?.id ?? null;
}
