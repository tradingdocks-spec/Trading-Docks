import type { ProductMarketingFeature } from "./product-marketing-registry";

export type IntelligenceInput = { audience: string; objective: string; channel: string };
export type IntelligenceProof = { id: string; name: string; featureIds: string[]; role: string | null; source: string; approved: boolean; marketingApproved: boolean; archived: boolean; signedUrl?: string | null };
export type IntelligenceCampaign = { featureId: string | null; audience: string; channel?: string; createdAt?: string };
export type IntelligenceGoldStandard = { featureId?: string | null; platform?: string; composition?: string };
export type MarketingOpportunity = { feature: ProductMarketingFeature; campaignAngle: string; why: string[]; productProof: IntelligenceProof | null; suggestedCta: string; alternatives: string[]; dataSource: string; freshness: "fresh" | "already_used" };

function fitScore(feature: ProductMarketingFeature, input: IntelligenceInput, proof: IntelligenceProof | null, campaigns: IntelligenceCampaign[], goldStandards: IntelligenceGoldStandard[]) {
  let score = 0;
  if (feature.audiences.includes(input.audience)) score += 5;
  if (feature.visualStrength === "strong") score += 4;
  if (feature.visualStrength === "moderate") score += 2;
  if (proof) score += proof.source === "canonical_product_capture" ? 5 : 2;
  if (goldStandards.some((item) => item.featureId === feature.id)) score += 2;
  const used = campaigns.filter((campaign) => campaign.featureId === feature.id).length;
  score -= Math.min(used, 3);
  if (input.objective === "awareness" && feature.visualStrength === "limited") score -= 3;
  if (input.channel === "instagram" && feature.visualStrength === "strong") score += 1;
  return score;
}

export function rankMarketingOpportunities(features: ProductMarketingFeature[], proofs: IntelligenceProof[], campaigns: IntelligenceCampaign[], goldStandards: IntelligenceGoldStandard[], input: IntelligenceInput): MarketingOpportunity[] {
  const candidates = features.map((feature) => {
    const proof = proofs.filter((asset) => asset.featureIds.includes(feature.id) && asset.approved && asset.marketingApproved && !asset.archived && feature.proofTypes.includes(asset.source === "canonical_product_capture" ? "canonical_product_capture" : "approved_product_screenshot")).sort((left, right) => Number(right.source === "canonical_product_capture") - Number(left.source === "canonical_product_capture") || left.name.localeCompare(right.name))[0] ?? null;
    const used = campaigns.some((campaign) => campaign.featureId === feature.id);
    const angle = feature.recommendedCaptureStates[0]?.description ?? feature.problemsSolved[0] ?? `Show the ${feature.name} workflow.`;
    const freshness: "fresh" | "already_used" = used ? "already_used" : "fresh";
    return { feature, campaignAngle: feature.slug === "chaos-sort" ? "Collections don't arrive organized." : angle, why: [`Relevant to ${input.audience.replaceAll("_", " ")}.`, feature.visualStrength === "strong" ? "Strong visual workflow with authentic product proof." : "Use only approved product metadata and synthetic proof.", proof ? `Approved ${proof.source === "canonical_product_capture" ? "canonical product capture" : "product proof"} is available.` : "No approved canonical proof is available yet."], productProof: proof, suggestedCta: feature.ctaOptions[0] ?? "See Trading Docks", alternatives: [], dataSource: "Approved product metadata + synthetic demo state", freshness, score: fitScore(feature, input, proof, campaigns, goldStandards) };
  }).filter((item) => item.feature.approvedClaims.length > 0 || item.productProof);
  const ranked = candidates.sort((left, right) => right.score - left.score || left.feature.name.localeCompare(right.feature.name));
  return ranked.map((item, index): MarketingOpportunity => ({
    feature: item.feature,
    campaignAngle: item.campaignAngle,
    why: item.why,
    productProof: item.productProof,
    suggestedCta: item.suggestedCta,
    alternatives: index === 0 ? ranked.slice(1, 3).map((candidate) => candidate.feature.name) : [],
    dataSource: item.dataSource,
    freshness: item.freshness,
  }));
}

export function buildCampaignDraftPlan(opportunity: MarketingOpportunity, input: IntelligenceInput) {
  return { source: "marketing_intelligence", audience: input.audience, objective: input.objective, channel: input.channel, feature: opportunity.feature.name, featureSlug: opportunity.feature.slug, campaignAngle: opportunity.campaignAngle, claims: opportunity.feature.approvedClaims, disallowedClaims: opportunity.feature.disallowedClaims, productProof: opportunity.productProof ? { id: opportunity.productProof.id, name: opportunity.productProof.name, role: opportunity.productProof.role, source: opportunity.productProof.source } : null, directions: ["product", "transformation", "editorial"], dataSource: opportunity.dataSource, publishing: "admin_approval_required", sending: "disabled_by_existing_flow" };
}
