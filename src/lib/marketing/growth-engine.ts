import { createHash } from "node:crypto";

export type ProspectSignal = {
  signal: string;
  value: string;
  confidence: "verified" | "high" | "medium" | "low" | "unknown";
  source_type: "business_finder" | "website" | "social" | "admin" | "provider";
  source_url?: string | null;
};

export type GrowthFeature = {
  id: string;
  slug: string;
  name: string;
  customer_description: string;
  relevant_cta: string;
  landing_url?: string | null;
  approved_claims?: unknown;
};

export type GrowthProspect = {
  id: string;
  business_name: string;
  city?: string | null;
  state?: string | null;
  website_url?: string | null;
  public_email?: string | null;
  category?: string | null;
};

const featureSignals: Record<string, string[]> = {
  "chaos-sort": ["sells_singles", "buys_collections", "large_singles_catalog", "hosts_events"],
  inventory: ["sells_singles", "multiple_locations", "large_singles_catalog", "uses_ebay", "uses_tcgplayer"],
  orders: ["sells_online", "uses_ebay", "uses_shopify", "uses_tcgplayer"],
};

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function buildFeatureFits(features: GrowthFeature[], signals: ProspectSignal[]) {
  const known = new Set(signals.filter((signal) => signal.value.trim().toLowerCase() === "true").map((signal) => signal.signal));
  return features.map((feature) => {
    const matched = (featureSignals[feature.slug] ?? []).filter((signal) => known.has(signal));
    const relevance = matched.length >= 2 ? "high" : matched.length === 1 ? "medium" : "unknown";
    return {
      feature_id: feature.id,
      relevance,
      reasons: matched.map((signal) => ({ signal, explanation: `Public or admin-provided signal: ${signal.replaceAll("_", " ")}.` })),
    } as const;
  });
}

export function buildCreativeBrief(feature: GrowthFeature, prospect: GrowthProspect, fitReasons: Array<{ signal: string; explanation: string }>) {
  return {
    campaignGoal: "outbound email",
    audience: prospect.category || "local game store",
    problem: fitReasons[0]?.explanation ?? "The business may benefit from a more connected card operation.",
    productPromise: feature.customer_description,
    primaryMessage: feature.name === "Chaos Sort" ? "Collections don't arrive organized." : feature.customer_description,
    supportingPoints: Array.isArray(feature.approved_claims) ? feature.approved_claims.map(String).slice(0, 3) : [],
    visualConcept: "Real Trading Docks product workflow with restrained TCG context.",
    featureId: feature.slug,
    productAssets: [],
    headlineDirection: feature.name,
    callToAction: feature.relevant_cta,
    compositionFamily: feature.name === "Chaos Sort" ? "workflow" : "feature_spotlight",
    prospectName: prospect.business_name,
  };
}

export function buildOutreachDraft(feature: GrowthFeature, prospect: GrowthProspect, fitReasons: Array<{ signal: string; explanation: string }>) {
  const firstName = prospect.business_name.split(/\s+/)[0] || "there";
  return {
    subject: `${feature.name} for ${prospect.business_name}`,
    previewText: feature.customer_description,
    bodyText: `Hi ${firstName},\n\nI came across ${prospect.business_name} while researching card businesses in ${[prospect.city, prospect.state].filter(Boolean).join(", ") || "your area"}. ${feature.customer_description}\n\n${feature.relevant_cta}${feature.landing_url ? `: ${feature.landing_url}` : ""}\n\nBest,\nTrading Docks`,
    rationale: fitReasons.map((reason) => ({ ...reason, note: "Used as a restrained personalization signal; no unsupported claim was added." })),
  };
}

export function hashGenerationInput(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function mockProviderMessageId(idempotencyKey: string) {
  return `mock_${hashGenerationInput(idempotencyKey).slice(0, 24)}`;
}
