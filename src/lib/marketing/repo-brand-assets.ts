export type RepoBrandAssetManifestEntry = {
  name: string;
  slug: string;
  storagePath: string;
  assetType: "logo" | "icon";
  brandRole: "logo_primary" | "logo_wordmark" | "logo_icon" | "app_icon_primary" | null;
  altText: string;
  width: number;
  height: number;
};

export const REPO_BRAND_ASSET_MANIFEST: readonly RepoBrandAssetManifestEntry[] = [
  { name: "trading-docks-mark", slug: "trading-docks-mark", storagePath: "/trading-docks-mark.png", assetType: "logo", brandRole: "logo_icon", altText: "Trading Docks mark", width: 1024, height: 1024 },
  { name: "trading-docks-logo", slug: "trading-docks-logo", storagePath: "/trading-docks-logo.png", assetType: "logo", brandRole: "logo_primary", altText: "Trading Docks logo lockup", width: 2048, height: 746 },
  { name: "trading-docks-horizontal", slug: "trading-docks-horizontal", storagePath: "/trading-docks-horizontal.png", assetType: "logo", brandRole: "logo_wordmark", altText: "Trading Docks horizontal wordmark", width: 2048, height: 746 },
  { name: "icon-1024", slug: "icon-1024", storagePath: "/icon-1024.png", assetType: "icon", brandRole: "app_icon_primary", altText: "Trading Docks app icon", width: 1024, height: 1024 },
  { name: "icon-512", slug: "icon-512", storagePath: "/icon-512.png", assetType: "icon", brandRole: null, altText: "Trading Docks app icon", width: 512, height: 512 },
  { name: "icon-256", slug: "icon-256", storagePath: "/icon-256.png", assetType: "icon", brandRole: null, altText: "Trading Docks app icon", width: 256, height: 256 },
  { name: "icon-192", slug: "icon-192", storagePath: "/icon-192.png", assetType: "icon", brandRole: null, altText: "Trading Docks app icon", width: 192, height: 192 },
  { name: "mstile-270x270", slug: "mstile-270x270", storagePath: "/mstile-270x270.png", assetType: "icon", brandRole: null, altText: "Trading Docks Windows tile icon", width: 270, height: 270 },
];

export function resolveAssetPreviewUrl(storagePath: string | null | undefined, signedUrl: string | null | undefined) {
  if (typeof storagePath === "string" && storagePath.startsWith("/")) return storagePath;
  return signedUrl ?? null;
}

export function repoBrandAssetRow(asset: RepoBrandAssetManifestEntry, actorId: string) {
  return {
    name: asset.name,
    slug: asset.slug,
    asset_type: asset.assetType,
    storage_path: asset.storagePath,
    mime_type: "image/png",
    width: asset.width,
    height: asset.height,
    tags: ["trading-docks", "repo-owned", asset.brandRole ?? "icon"],
    feature_ids: [],
    game_ids: [],
    approved_for_marketing: true,
    approval_status: "approved",
    source: "repo_owned",
    source_url: null,
    license_notes: "Trading Docks owned brand asset.",
    alt_text: asset.altText,
    product_display_allowed: true,
    marketing_use_approved: true,
    brand_role: asset.brandRole,
    screenshot_role: null,
    focal_x: 0.5,
    focal_y: 0.5,
    safe_crop: true,
    preferred_aspect_ratios: [`${asset.width}:${asset.height}`],
    created_by: actorId,
  };
}

export function isKnownRepoBrandAsset(name: string) {
  return REPO_BRAND_ASSET_MANIFEST.some((asset) => asset.name === name || asset.slug === name);
}

const LEGACY_BRAND_ASSET_PATTERNS = [
  /^android-chrome(?:-|$)/i,
  /^apple-touch-icon(?:-|$)/i,
  /^app-store-icon-1024(?:-|$)/i,
  /^discord-icon-512(?:-|$)/i,
  /^favicon(?:-|$)/i,
  /^icon-(?:16|32|48|64|128|180)(?:-|$)/i,
];

export type LegacyBrandAssetCandidate = {
  name: string | null | undefined;
  slug?: string | null;
  assetType: string | null | undefined;
  approvalStatus: string | null | undefined;
  source: string | null | undefined;
  brandRole?: string | null;
};

export function isRedundantLegacyBrandAsset(asset: LegacyBrandAssetCandidate) {
  if (!["icon", "other"].includes(asset.assetType ?? "") || asset.approvalStatus !== "draft" || asset.source === "repo_owned" || asset.brandRole) return false;
  return [asset.name, asset.slug].some((value) => typeof value === "string" && LEGACY_BRAND_ASSET_PATTERNS.some((pattern) => pattern.test(value)));
}
