import { buildRenderSpec, CREATIVE_FORMATS, type CreativePlatform } from "./creative-renderer.ts";
import { generateCreativeDirections, type CreativeConcept } from "./brand-system.ts";
import { buildCampaignDraftPlan, rankMarketingOpportunities, type IntelligenceInput, type IntelligenceProof, type IntelligenceCampaign, type IntelligenceGoldStandard } from "./marketing-intelligence.ts";
import type { ProductMarketingFeature } from "./product-marketing-registry.ts";

export type AutopilotInput = IntelligenceInput & { focus?: string };
export type AutopilotCopyPackage = { primaryHeadline: string; alternateHeadline: string; supportingLine: string; cta: string; instagramCaption: string; facebookCaption: string; emailSubject: string; emailPreviewText: string; emailBody: string; shortOutreach: string; websiteHero: string };
export type AutopilotPackage = { input: AutopilotInput; feature: ProductMarketingFeature; plan: ReturnType<typeof buildCampaignDraftPlan>; directions: CreativeConcept[]; recommendedDirection: CreativeConcept["id"]; copy: AutopilotCopyPackage; variants: Array<{ platform: CreativePlatform; width: number; height: number; filename: string }>; source: "approved_product_metadata_and_synthetic_demo_state"; autonomousActions: string[] };

export function buildMarketingAutopilotPackage(features: ProductMarketingFeature[], proofs: IntelligenceProof[], campaigns: IntelligenceCampaign[], goldStandards: IntelligenceGoldStandard[], input: AutopilotInput): AutopilotPackage {
  const opportunities = rankMarketingOpportunities(features, proofs, campaigns, goldStandards, input);
  const chosen = input.focus ? opportunities.find((item) => item.feature.slug === input.focus) ?? opportunities[0] : opportunities[0];
  if (!chosen) throw new Error("No approved product opportunity is ready for this campaign.");
  const plan = buildCampaignDraftPlan(chosen, input);
  const directions = generateCreativeDirections({ featureName: chosen.feature.name, customerDescription: chosen.feature.problemsSolved[0], objective: input.objective, audience: input.audience, cta: chosen.suggestedCta });
  const recommendedDirection = directions.slice().sort((left, right) => directionScore(right, chosen, input) - directionScore(left, chosen, input))[0]?.id ?? "product";
  const copy = buildCopyPackage(chosen.feature.name, chosen.campaignAngle, chosen.suggestedCta, directions.find((item) => item.id === recommendedDirection) ?? directions[0]);
  const platforms: CreativePlatform[] = input.channel === "instagram" ? ["instagram_square", "instagram_portrait", "instagram_story"] : input.channel === "facebook" ? ["facebook", "google_landscape"] : input.channel === "email" ? ["email"] : input.channel === "website" ? ["google_landscape"] : ["instagram_square", "instagram_portrait", "instagram_story", "facebook", "google_landscape", "email"];
  const variants = platforms.map((platform) => { const format = CREATIVE_FORMATS[platform]; return { platform, width: format.width, height: format.height, filename: `trading-docks-${slugify(chosen.feature.name)}-${platform}-${format.width}x${format.height}.png` }; });
  return { input, feature: chosen.feature, plan, directions, recommendedDirection, copy, variants, source: "approved_product_metadata_and_synthetic_demo_state", autonomousActions: ["no_social_publish", "no_paid_ads", "no_email_send", "no_customer_data_access"] };
}

function directionScore(direction: CreativeConcept, opportunity: { feature: ProductMarketingFeature; productProof: IntelligenceProof | null }, input: IntelligenceInput) { return (direction.id === "product" && opportunity.productProof ? 5 : 0) + (direction.id === "product" && opportunity.feature.visualStrength === "strong" ? 2 : 0) + (input.objective === "awareness" && direction.id === "editorial" ? 1 : 0); }
function buildCopyPackage(feature: string, angle: string, cta: string, direction: CreativeConcept): AutopilotCopyPackage { const headline = direction.headline; const supportingLine = direction.subheadline; return { primaryHeadline: headline, alternateHeadline: `${feature}: ${angle}`, supportingLine, cta, instagramCaption: `${headline} ${supportingLine} ${cta}.`, facebookCaption: `${headline}\n\n${supportingLine}\n\n${cta}.`, emailSubject: `${feature}: ${headline}`, emailPreviewText: supportingLine, emailBody: `${headline}\n\n${supportingLine}\n\n${cta}.`, shortOutreach: `${headline} ${supportingLine} ${cta}.`, websiteHero: `${headline} — ${supportingLine}` }; }
function slugify(value: string) { return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }

export function buildAutopilotRenderSpec(input: { package: AutopilotPackage; platform: CreativePlatform; productAssetUrl?: string }) { const direction = input.package.directions.find((item) => item.id === input.package.recommendedDirection) ?? input.package.directions[0]; return buildRenderSpec({ platform: input.platform, composition: direction.compositionFamily, featureName: input.package.feature.name, headline: input.package.copy.primaryHeadline, subheadline: input.package.copy.supportingLine, cta: input.package.copy.cta, productAssetUrl: input.productAssetUrl, conceptDirection: direction.id }); }
