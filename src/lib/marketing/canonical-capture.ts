import { getMarketingDemoFixture } from "./marketing-demo-fixtures.ts";
import { registryFeatureFor } from "./product-marketing-registry.ts";

export type CanonicalCaptureRequest = { feature: string; state: string; viewport: "desktop" | "tablet" | "mobile"; role: "primary" | "workflow" | "detail" | "mobile" | "before" | "after"; width: number; height: number };
export type CanonicalCaptureMetadata = { name: string; slug: string; assetType: "product_screenshot"; storagePath: string; source: "canonical_product_capture"; featureIds: string[]; screenshotRole: CanonicalCaptureRequest["role"]; approvalStatus: "approved"; marketingUseApproved: true; captureVersion: string; safeCrop: true; width: number; height: number };

export function validateCanonicalCaptureRequest(input: Partial<CanonicalCaptureRequest>): CanonicalCaptureRequest {
  if (typeof input.feature !== "string" || !registryFeatureFor(input.feature)) throw new Error("Unknown canonical marketing feature.");
  if (typeof input.state !== "string" || !getMarketingDemoFixture(input.feature, input.state)) throw new Error("Unknown synthetic marketing capture state.");
  const viewport = input.viewport === "tablet" || input.viewport === "mobile" ? input.viewport : "desktop";
  const roles = new Set<CanonicalCaptureRequest["role"]>(["primary", "workflow", "detail", "mobile", "before", "after"]);
  const role = roles.has(input.role as CanonicalCaptureRequest["role"]) ? input.role as CanonicalCaptureRequest["role"] : "primary";
  return { feature: input.feature, state: input.state, viewport, role, width: typeof input.width === "number" ? input.width : viewport === "mobile" ? 390 : 1440, height: typeof input.height === "number" ? input.height : viewport === "mobile" ? 844 : 1000 };
}

export function buildCanonicalCaptureMetadata(request: CanonicalCaptureRequest, featureId: string, version = "v1"): CanonicalCaptureMetadata {
  const fixture = getMarketingDemoFixture(request.feature, request.state);
  const feature = registryFeatureFor(request.feature);
  if (!fixture || !feature) throw new Error("Canonical capture fixture is unavailable.");
  const slug = `${feature.slug}-${request.state}-${request.viewport}-${version}`;
  return { name: `${feature.name} · ${fixture.label}`, slug, assetType: "product_screenshot", storagePath: `canonical/${feature.slug}/${request.state}/${request.viewport}-${version}.png`, source: "canonical_product_capture", featureIds: [featureId], screenshotRole: request.role, approvalStatus: "approved", marketingUseApproved: true, captureVersion: version, safeCrop: true, width: request.width, height: request.height };
}

export function marketingCaptureImportsAreSafe(source: string) {
  return !/(?:marketing_prospects|marketing_outreach|inventory_items|orders|customers|payments|supabase\/admin)/.test(source);
}
