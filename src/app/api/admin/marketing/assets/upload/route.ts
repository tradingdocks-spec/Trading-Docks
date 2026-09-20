import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

function dimensions(bytes: Uint8Array, mime: string) {
  if (mime === "image/png" && bytes.length >= 24) return { width: new DataView(bytes.buffer, bytes.byteOffset).getUint32(16), height: new DataView(bytes.buffer, bytes.byteOffset).getUint32(20) };
  if (mime === "image/gif" && bytes.length >= 10) return { width: bytes[6] | bytes[7] << 8, height: bytes[8] | bytes[9] << 8 };
  if (mime === "image/jpeg") {
    let offset = 2;
    while (offset + 9 < bytes.length) { if (bytes[offset] !== 0xff) { offset += 1; continue; } const marker = bytes[offset + 1]; const length = (bytes[offset + 2] << 8) | bytes[offset + 3]; if (marker >= 0xc0 && marker <= 0xc3) return { height: (bytes[offset + 5] << 8) | bytes[offset + 6], width: (bytes[offset + 7] << 8) | bytes[offset + 8] }; offset += Math.max(2, length); }
  }
  return { width: null, height: null };
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "An image file is required." }, { status: 400 });
  if (!MIME_TYPES.has(file.type)) return NextResponse.json({ error: "Only PNG, JPEG, and WebP images are allowed." }, { status: 400 });
  if (file.size <= 0 || file.size > MAX_BYTES) return NextResponse.json({ error: "Images must be smaller than 10 MB." }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
  const path = `${actor.user.id}/${new Date().toISOString().slice(0, 10)}/${randomUUID()}.${extension}`;
  const featureIdsValue = form.get("featureIds");
  let featureIds: string[] = [];
  if (typeof featureIdsValue === "string" && featureIdsValue) {
    try {
      const parsed = JSON.parse(featureIdsValue);
      if (Array.isArray(parsed)) featureIds = parsed.filter((value): value is string => typeof value === "string").slice(0, 20);
    } catch {
      featureIds = [];
    }
  }
  const screenshotRole = String(form.get("screenshotRole") || "").trim().slice(0, 40) || null;
  const admin = createAdminClient();
  const upload = await admin.storage.from("marketing-assets").upload(path, file, { contentType: file.type, upsert: false });
  if (upload.error) return NextResponse.json({ error: "Image upload failed. Confirm the staging Asset Vault migration is applied." }, { status: 503 });
  const metadata = await admin.from("marketing_assets").insert({ name: file.name.replace(/\.[^.]+$/, "").slice(0, 160), asset_type: form.get("assetType") || "product_screenshot", storage_path: path, mime_type: file.type, width: dimensions(bytes, file.type).width, height: dimensions(bytes, file.type).height, tags: String(form.get("tags") || "").split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 30), feature_ids: featureIds, screenshot_role: screenshotRole, source: String(form.get("source") || "admin_uploaded").slice(0, 120), source_url: String(form.get("sourceUrl") || "").slice(0, 500) || null, license_notes: String(form.get("licenseNotes") || "").slice(0, 2000), alt_text: String(form.get("altText") || "").slice(0, 300), product_display_allowed: form.get("productDisplayAllowed") === "true", marketing_use_approved: false, approval_status: "draft", created_by: actor.user.id }).select("id,name,asset_type,feature_ids,screenshot_role,width,height,approval_status,storage_path").single();
  if (metadata.error || !metadata.data) return NextResponse.json({ error: "Image metadata could not be saved." }, { status: 503 });
  return NextResponse.json({ asset: metadata.data }, { status: 201 });
}
