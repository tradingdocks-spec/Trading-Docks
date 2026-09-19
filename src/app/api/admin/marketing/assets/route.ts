import { NextResponse } from "next/server";
import { requireServerPlatformRole } from "@/lib/identity/server-guards";
import { isRedundantLegacyBrandAsset, resolveAssetPreviewUrl } from "@/lib/marketing/repo-brand-assets";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
const ASSET_TYPES = ["logo", "product_screenshot", "feature_screenshot", "card_image", "background", "texture", "device_mockup", "icon", "campaign_artwork", "social_export", "email_export", "other"] as const;
const APPROVAL_STATES = ["draft", "approved", "restricted", "archived"] as const;
const VIEWS = ["curated", "brand", "product", "approved", "draft", "archived", "all"] as const;
const CANONICAL_ROLES = new Set(["logo_primary", "logo_wordmark", "logo_icon", "app_icon_primary"]);

function safeAsset(asset: Record<string, unknown>, signedUrl?: string | null) {
  return { ...asset, signed_url: resolveAssetPreviewUrl(typeof asset.storage_path === "string" ? asset.storage_path : null, signedUrl) };
}

export async function GET(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const url = new URL(request.url);
  const admin = createAdminClient();
  let query = admin.from("marketing_assets").select("id,name,slug,asset_type,storage_path,mime_type,width,height,tags,feature_ids,game_ids,approved_for_marketing,approval_status,source,source_url,license_notes,alt_text,product_display_allowed,marketing_use_approved,brand_role,screenshot_role,focal_x,focal_y,safe_crop,preferred_aspect_ratios,archived_at,created_at,updated_at").order("updated_at", { ascending: false }).limit(500);
  const type = url.searchParams.get("type");
  const approval = url.searchParams.get("approval");
  const view = VIEWS.includes((url.searchParams.get("view") ?? "curated") as typeof VIEWS[number]) ? (url.searchParams.get("view") ?? "curated") as typeof VIEWS[number] : "curated";
  const search = url.searchParams.get("search");
  if (type && ASSET_TYPES.includes(type as typeof ASSET_TYPES[number])) query = query.eq("asset_type", type);
  if (approval && APPROVAL_STATES.includes(approval as typeof APPROVAL_STATES[number])) query = query.eq("approval_status", approval);
  if (view === "archived") query = query.not("archived_at", "is", null);
  else if (view !== "all") query = query.is("archived_at", null);
  if (search) query = query.ilike("name", `%${search.replaceAll("%", "\\%")}%`);
  const { data, error } = await query;
  if (error) return NextResponse.json({ error: "Asset Vault is not initialized. Apply the documented staging migration first." }, { status: 503 });
  const filtered = (data ?? []).filter((asset) => {
    const legacy = isRedundantLegacyBrandAsset({ name: asset.name, slug: asset.slug, assetType: asset.asset_type, approvalStatus: asset.approval_status, source: asset.source, brandRole: asset.brand_role });
    if (view === "curated") return !legacy;
    if (view === "brand") return (asset.source === "repo_owned" || CANONICAL_ROLES.has(asset.brand_role ?? "")) && !legacy;
    if (view === "product") return ["product_screenshot", "feature_screenshot"].includes(asset.asset_type) && !legacy;
    if (view === "approved") return asset.approval_status === "approved" && !legacy;
    if (view === "draft") return asset.approval_status === "draft" && !legacy;
    return true;
  }).sort((left, right) => {
    const rank = (asset: Record<string, unknown>) => (CANONICAL_ROLES.has(String(asset.brand_role ?? "")) ? 0 : asset.approval_status === "approved" ? 1 : ["product_screenshot", "feature_screenshot"].includes(String(asset.asset_type ?? "")) ? 2 : asset.asset_type === "campaign_artwork" ? 3 : asset.archived_at ? 5 : 4);
    return rank(left) - rank(right) || String(right.updated_at ?? "").localeCompare(String(left.updated_at ?? ""));
  }).slice(0, 300);
  const assets = await Promise.all(filtered.map(async (asset: Record<string, unknown>) => {
    if (typeof asset.storage_path !== "string" || asset.storage_path.startsWith("/")) return safeAsset(asset);
    const signed = await admin.storage.from("marketing-assets").createSignedUrl(asset.storage_path, 600);
    return safeAsset(asset, signed.data?.signedUrl);
  }));
  return NextResponse.json({ assets, assetTypes: ASSET_TYPES, approvalStates: APPROVAL_STATES, views: VIEWS, view });
}

export async function POST(request: Request) {
  const actor = await requireServerPlatformRole("admin");
  if (!actor) return NextResponse.json({ error: "Administrator access required." }, { status: 403 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body || typeof body.name !== "string" || typeof body.assetType !== "string") return NextResponse.json({ error: "Name and asset type are required." }, { status: 400 });
  if (!ASSET_TYPES.includes(body.assetType as typeof ASSET_TYPES[number])) return NextResponse.json({ error: "Unsupported asset type." }, { status: 400 });
  if (body.approvalStatus && !APPROVAL_STATES.includes(body.approvalStatus as typeof APPROVAL_STATES[number])) return NextResponse.json({ error: "Unsupported approval state." }, { status: 400 });
  if (body.approvalStatus === "approved" && body.marketingUseApproved !== true) return NextResponse.json({ error: "Marketing approval requires confirmed commercial-use approval." }, { status: 400 });
  const admin = createAdminClient();
  const row = {
    name: body.name.trim().slice(0, 160), slug: typeof body.slug === "string" ? body.slug.trim().slice(0, 160) || null : null,
    asset_type: body.assetType, storage_path: typeof body.storagePath === "string" ? body.storagePath : `/Brand/${body.name.trim()}`,
    mime_type: typeof body.mimeType === "string" ? body.mimeType : "image/png", width: typeof body.width === "number" ? body.width : null, height: typeof body.height === "number" ? body.height : null,
    tags: Array.isArray(body.tags) ? body.tags.filter((value): value is string => typeof value === "string").slice(0, 30) : [], feature_ids: [], game_ids: [], approved_for_marketing: body.approvalStatus === "approved", approval_status: body.approvalStatus ?? "draft", source: typeof body.source === "string" ? body.source.slice(0, 120) : "admin_uploaded", source_url: typeof body.sourceUrl === "string" ? body.sourceUrl.slice(0, 500) : null, license_notes: typeof body.licenseNotes === "string" ? body.licenseNotes.slice(0, 2000) : "", alt_text: typeof body.altText === "string" ? body.altText.slice(0, 300) : "", product_display_allowed: body.productDisplayAllowed === true, marketing_use_approved: body.marketingUseApproved === true, brand_role: typeof body.brandRole === "string" ? body.brandRole.slice(0, 80) : null, screenshot_role: typeof body.screenshotRole === "string" ? body.screenshotRole.slice(0, 40) : null, focal_x: typeof body.focalX === "number" ? body.focalX : null, focal_y: typeof body.focalY === "number" ? body.focalY : null, safe_crop: body.safeCrop === true, preferred_aspect_ratios: Array.isArray(body.preferredAspectRatios) ? body.preferredAspectRatios.filter((value): value is string => typeof value === "string").slice(0, 12) : [], created_by: actor.user.id,
  };
  const { data, error } = await admin.from("marketing_assets").insert(row).select("id,name,asset_type,storage_path,approval_status,marketing_use_approved").single();
  if (error || !data) return NextResponse.json({ error: "Asset metadata could not be saved." }, { status: 503 });
  return NextResponse.json({ asset: data }, { status: 201 });
}
