import type { CompositionFamily, CreativePlatform } from "./creative-renderer";

export type MarketingBrandTokens = {
  colors: {
    backgroundPrimary: string;
    backgroundSecondary: string;
    surface: string;
    accent: string;
    textPrimary: string;
    textSecondary: string;
    border: string;
    success: string;
    warning: string;
  };
  typography: {
    displayFamily: string;
    headlineFamily: string;
    bodyFamily: string;
    labelFamily: string;
  };
  radii: { productFrame: number; cta: number; card: number };
  spacing: { safeMargin: number; logoClearSpace: number };
};

export const DEFAULT_MARKETING_BRAND_TOKENS: MarketingBrandTokens = {
  colors: { backgroundPrimary: "#0a101b", backgroundSecondary: "#14243b", surface: "#182a42", accent: "#35cafa", textPrimary: "#eff6ff", textSecondary: "#b9cae1", border: "#304762", success: "#52d69a", warning: "#f4c95d" },
  typography: { displayFamily: "Geist, Arial, sans-serif", headlineFamily: "Geist, Arial, sans-serif", bodyFamily: "Geist, Arial, sans-serif", labelFamily: "Geist Mono, monospace" },
  radii: { productFrame: 18, cta: 22, card: 16 },
  spacing: { safeMargin: 72, logoClearSpace: 24 },
};

export const APPROVED_CTA_LANGUAGE = ["See Chaos Sort", "Explore Inventory", "See Trading Docks", "Start Sorting", "View the Workflow", "Try Trading Docks"];
export const PROHIBITED_CREATIVE_PATTERNS = ["random neon gradient", "floating glowing orb", "generic 3d cube", "fake holographic ui", "robot imagery", "random particles", "excessive glow", "fake dashboard", "fake statistics", "fake product screenshots", "stock corporate people", "generic future technology"];

export function validateCreativeCopy(copy: string, approvedClaims: string[], disallowedClaims: string[]) {
  const normalized = copy.toLowerCase();
  if (disallowedClaims.some((claim) => claim.trim() && normalized.includes(claim.toLowerCase().trim()))) return false;
  const unsupportedClaimPattern = /\b(integrat(?:e|es|ion)|works with|syncs? with|guarantee(?:s|d)?|[0-9]+x faster|[0-9]+%|million users?|customers? use)\b/i;
  if (!unsupportedClaimPattern.test(copy)) return true;
  return approvedClaims.some((claim) => claim.trim() && normalized.includes(claim.toLowerCase().trim()));
}

export type CreativeConcept = {
  id: "product" | "transformation" | "editorial";
  direction: "product" | "transformation" | "editorial";
  conceptName: string;
  audienceInsight: string;
  primaryMessage: string;
  headline: string;
  subheadline: string;
  visualStory: string;
  compositionFamily: CompositionFamily;
  productAssetStrategy: string;
  supportingAssetStrategy: string;
  logoPlacement: "top_left" | "top_right" | "bottom_left" | "bottom_right" | "footer_lockup";
  cta: string;
  brandSignatureElements: string[];
};

type DirectionInput = { featureName: string; customerDescription?: string; objective?: string; audience?: string; cta?: string };

export function generateCreativeDirections(input: DirectionInput): CreativeConcept[] {
  const feature = input.featureName.trim() || "Trading Docks";
  const cta = APPROVED_CTA_LANGUAGE.includes(input.cta ?? "") ? input.cta! : feature === "Chaos Sort" ? "See Chaos Sort" : "See Trading Docks";
  const description = input.customerDescription?.trim() || `A practical ${feature.toLowerCase()} workflow for TCG operators.`;
  return [
    { id: "product", direction: "product", conceptName: `${feature} / Product proof`, audienceInsight: `Operators want to see the real ${feature} workflow before they trust the claim.`, primaryMessage: description, headline: feature === "Chaos Sort" ? "Sort the chaos." : `See ${feature}.`, subheadline: description, visualStory: "Authentic Trading Docks UI is the visual hero with restrained framing and generous negative space.", compositionFamily: "product_hero", productAssetStrategy: "Use one approved primary product screenshot at the largest readable scale.", supportingAssetStrategy: "No decorative image is required; use the approved accent treatment only.", logoPlacement: "top_right", cta, brandSignatureElements: ["approved logo", "real product UI", "navy surface", "cyan CTA"] },
    { id: "transformation", direction: "transformation", conceptName: `${feature} / From problem to workflow`, audienceInsight: `${input.audience || "TCG operators"} recognize the daily problem before they recognize the feature name.`, primaryMessage: `Turn the work around ${feature.toLowerCase()} into a clear next step.`, headline: feature === "Chaos Sort" ? "Collections don't arrive organized." : `Make ${feature.toLowerCase()} easier to run.`, subheadline: description, visualStory: "A controlled before/after story moves from operational friction to an authentic Trading Docks workflow.", compositionFamily: "before_after", productAssetStrategy: "Use a real product screenshot on the resolved side; never fabricate the problem state as a fake UI.", supportingAssetStrategy: "Use one or two approved TCG images as supporting context with controlled crop and overlap.", logoPlacement: "bottom_left", cta, brandSignatureElements: ["product-specific copy", "before/after hierarchy", "approved TCG imagery", "signature spacing"] },
    { id: "editorial", direction: "editorial", conceptName: `${feature} / Editorial system`, audienceInsight: "A premium TCG audience responds to confident editorial restraint more than decorative novelty.", primaryMessage: `From ${feature.toLowerCase()} to a more dependable operation.`, headline: feature === "Chaos Sort" ? "Make intake traceable." : `${feature} that feels organized.`, subheadline: description, visualStory: "Selective TCG imagery, confident typography, and a small amount of real product context create a recognizable brand composition.", compositionFamily: "editorial_tcg", productAssetStrategy: "Use a detail or workflow screenshot as proof, not as a decorative fake dashboard.", supportingAssetStrategy: "Use one hero card or a controlled two-to-three-card stack from approved assets.", logoPlacement: "footer_lockup", cta, brandSignatureElements: ["editorial typography", "selective card imagery", "real product context", "restrained composition"] },
  ];
}

export type BrandCheck = { key: string; status: "pass" | "warning" | "fail"; message: string; blocking: boolean };

export function validateMarketingBrandTokens(tokens: MarketingBrandTokens) {
  const issues: string[] = [];
  for (const value of Object.values(tokens.colors)) if (!/^#[0-9a-f]{6}$/i.test(value)) issues.push("invalid_color_token");
  if (!tokens.typography.displayFamily || !tokens.typography.headlineFamily || !tokens.typography.bodyFamily || !tokens.typography.labelFamily) issues.push("missing_typography_role");
  if (tokens.spacing.safeMargin < 24 || tokens.spacing.logoClearSpace < 8) issues.push("unsafe_spacing_token");
  return [...new Set(issues)];
}

export function runBrandQualityChecks(input: { headline: string; subheadline: string; cta: string; platform: CreativePlatform; productAssetApproved: boolean; logoAssetApproved: boolean; hasFeatureCopy: boolean; claimsApproved?: boolean; hasApprovedPalette?: boolean; hasOverflow?: boolean; }) : BrandCheck[] {
  const checks: BrandCheck[] = [
    { key: "logo", status: input.logoAssetApproved ? "pass" : "fail", message: input.logoAssetApproved ? "Approved Trading Docks logo is assigned." : "An approved Trading Docks logo is required.", blocking: true },
    { key: "palette", status: input.hasApprovedPalette === false ? "fail" : "pass", message: input.hasApprovedPalette === false ? "Creative does not use the approved palette." : "Approved color system is assigned.", blocking: true },
    { key: "product_proof", status: input.productAssetApproved ? "pass" : "fail", message: input.productAssetApproved ? "Approved product proof is assigned." : "An approved product screenshot or feature visual is required.", blocking: true },
    { key: "feature_copy", status: input.hasFeatureCopy ? "pass" : "fail", message: input.hasFeatureCopy ? "Copy is tied to a feature." : "Feature-specific copy is required.", blocking: true },
    { key: "claims", status: input.claimsApproved === false ? "fail" : "pass", message: input.claimsApproved === false ? "Copy contains an unsupported or disallowed claim." : "Copy is grounded in approved feature facts.", blocking: true },
    { key: "cta", status: APPROVED_CTA_LANGUAGE.includes(input.cta) ? "pass" : "warning", message: APPROVED_CTA_LANGUAGE.includes(input.cta) ? "CTA uses approved language." : "CTA should use approved Trading Docks language.", blocking: false },
    { key: "headline_length", status: input.headline.trim().length <= 52 ? "pass" : "warning", message: input.headline.trim().length <= 52 ? "Headline is concise." : "Headline may be difficult to read quickly.", blocking: false },
    { key: "copy_length", status: input.subheadline.trim().length <= 150 ? "pass" : "fail", message: input.subheadline.trim().length <= 150 ? "Supporting copy fits the system." : "Supporting copy is too long.", blocking: true },
    { key: "overflow", status: input.hasOverflow ? "fail" : "pass", message: input.hasOverflow ? "Text overflow must be resolved." : "No text overflow reported.", blocking: true },
    { key: "generic_brand_risk", status: input.productAssetApproved && input.hasFeatureCopy ? "pass" : "warning", message: input.productAssetApproved && input.hasFeatureCopy ? "Product-specific signature is present." : "Creative may read as a generic SaaS advertisement.", blocking: false },
  ];
  return checks;
}

export function hasBlockingBrandIssues(checks: BrandCheck[]) { return checks.some((check) => check.blocking && check.status === "fail"); }
