import type { CreativeConcept } from "./brand-system.ts";
import { buildRenderSpec, type CreativePlatform, type CreativeRenderSpec } from "./creative-renderer.ts";

export const CHAOS_SORT_FEATURE_SLUG = "chaos-sort";
export const CHAOS_SORT_CAMPAIGN_NAME = "Sort the Chaos";
export const CHAOS_SORT_AUDIENCE = "local_game_store";
export const CHAOS_SORT_OBJECTIVE = "awareness";

export const CHAOS_SORT_RENDER_PLATFORMS: CreativePlatform[] = ["instagram_square", "instagram_portrait", "instagram_story", "facebook", "google_landscape", "email"];

export const CHAOS_SORT_PROFILE = {
  description: "Turn unsorted cards into identifiable, trackable inventory.",
  targetAudiences: ["local_game_store", "high_volume_online_seller"],
  problemsSolved: ["unorganized collection intake", "unknown card identity"],
  approvedClaims: ["Supports card intake, batches, and physical locations."],
  prohibitedClaims: ["Sorts inventory 10x faster"],
  ctas: ["See Chaos Sort", "Start Sorting", "View the Workflow"],
  screenshotRoles: ["primary", "workflow", "detail", "mobile"],
} as const;

export type ChaosSortScreenshot = {
  id: string;
  name: string;
  asset_type: string;
  feature_ids?: string[] | null;
  screenshot_role?: string | null;
  approval_status: string;
  marketing_use_approved: boolean;
  archived_at?: string | null;
};

const roleRank: Record<string, number> = { primary: 0, workflow: 1, detail: 2, mobile: 3 };

export function selectChaosSortScreenshot(assets: ChaosSortScreenshot[], featureId: string) {
  return assets
    .filter((asset) => asset.feature_ids?.includes(featureId) && ["product_screenshot", "feature_screenshot"].includes(asset.asset_type) && asset.approval_status === "approved" && asset.marketing_use_approved && !asset.archived_at && asset.screenshot_role && roleRank[asset.screenshot_role] !== undefined)
    .sort((left, right) => (roleRank[left.screenshot_role ?? ""] ?? 99) - (roleRank[right.screenshot_role ?? ""] ?? 99) || left.name.localeCompare(right.name))[0] ?? null;
}

export function buildChaosSortBenchmarkSpecs(concept: CreativeConcept, screenshotUrl: string, logoUrl = "/trading-docks-horizontal.png", brandProfileVersion = 1): CreativeRenderSpec[] {
  return CHAOS_SORT_RENDER_PLATFORMS.map((platform) => buildRenderSpec({ platform, composition: concept.compositionFamily, featureName: "Chaos Sort", headline: concept.headline, subheadline: concept.subheadline, cta: concept.cta, productAssetUrl: screenshotUrl, logoAssetUrl: logoUrl, conceptDirection: concept.direction, logoPlacement: concept.logoPlacement, brandProfileVersion }));
}
