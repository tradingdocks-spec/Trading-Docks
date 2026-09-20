export type MarketingProofType = "canonical_product_capture" | "approved_product_screenshot" | "approved_feature_screenshot" | "brand_asset";
export type MarketingCaptureState = { id: string; label: string; description: string; fixtureKey: string };

export type ProductMarketingFeature = {
  id: string;
  name: string;
  slug: string;
  route: string;
  audiences: string[];
  problemsSolved: string[];
  capabilities: string[];
  approvedClaims: string[];
  disallowedClaims: string[];
  visualStrength: "strong" | "moderate" | "limited";
  proofTypes: MarketingProofType[];
  recommendedCaptureStates: MarketingCaptureState[];
  ctaOptions: string[];
  landingUrl: string | null;
  source: "approved_feature_library" | "product_registry";
};

const capture = (id: string, label: string, description: string): MarketingCaptureState => ({ id, label, description, fixtureKey: id });

export const MARKETING_PRODUCT_REGISTRY: readonly ProductMarketingFeature[] = [
  { id: "chaos-sort", name: "Chaos Sort", slug: "chaos-sort", route: "/dashboard/inventory/chaos-sort", audiences: ["local_game_store", "high_volume_online_seller"], problemsSolved: ["unorganized collection intake", "unknown card identity"], capabilities: ["scan cards", "build batches", "assign locations"], approvedClaims: ["Supports card intake, batches, and physical locations."], disallowedClaims: ["Sorts inventory 10x faster"], visualStrength: "strong", proofTypes: ["canonical_product_capture", "approved_product_screenshot"], recommendedCaptureStates: [capture("primary", "Primary intake", "Synthetic active batch with recognized cards."), capture("locations", "Location assignment", "Synthetic batch with physical positions."), capture("review", "Review state", "Synthetic cards awaiting operator confirmation.")], ctaOptions: ["See Chaos Sort", "Start Sorting"], landingUrl: "/dashboard/inventory/chaos-sort", source: "approved_feature_library" },
  { id: "inventory", name: "Inventory", slug: "inventory", route: "/dashboard/inventory", audiences: ["local_game_store", "multi_location_store", "high_volume_online_seller"], problemsSolved: ["lost physical cards", "unclear provenance"], capabilities: ["track inventory", "preserve batch and location provenance"], approvedClaims: ["Keeps card records connected to physical inventory context."], disallowedClaims: ["Eliminates all inventory errors"], visualStrength: "strong", proofTypes: ["canonical_product_capture", "approved_product_screenshot"], recommendedCaptureStates: [capture("locations", "Inventory locations", "Synthetic positions, batches, and movement history."), capture("provenance", "Batch provenance", "Synthetic card records with batch context.")], ctaOptions: ["Explore Inventory", "Know Where It Is"], landingUrl: "/dashboard/inventory", source: "approved_feature_library" },
  { id: "orders", name: "Orders Center", slug: "orders", route: "/dashboard/orders", audiences: ["local_game_store", "high_volume_online_seller"], problemsSolved: ["missed fulfillment steps"], capabilities: ["review orders", "track fulfillment work"], approvedClaims: ["Provides an operational view for order work."], disallowedClaims: ["Guarantees same-day fulfillment"], visualStrength: "moderate", proofTypes: ["canonical_product_capture"], recommendedCaptureStates: [capture("pick-pack", "Pick and pack", "Synthetic marketplace orders with fulfillment states.")], ctaOptions: ["Explore Orders", "See the Workflow"], landingUrl: "/dashboard/orders", source: "approved_feature_library" },
  { id: "analytics", name: "Analytics", slug: "analytics", route: "/dashboard/analytics", audiences: ["local_game_store", "multi_location_store"], problemsSolved: ["unclear operating trends"], capabilities: ["review business metrics"], approvedClaims: [], disallowedClaims: ["Guaranteed growth", "fabricated ROI"], visualStrength: "limited", proofTypes: ["canonical_product_capture"], recommendedCaptureStates: [capture("overview", "Analytics overview", "Deterministic internal demo metrics, clearly marked demo.")], ctaOptions: ["See Trading Docks"], landingUrl: "/dashboard/analytics", source: "product_registry" },
  { id: "collection-buying", name: "Collection Buying", slug: "collection-buying", route: "/dashboard/collection-buying", audiences: ["local_game_store", "high_volume_online_seller"], problemsSolved: ["inconsistent collection intake decisions"], capabilities: ["review collection buying workflows"], approvedClaims: [], disallowedClaims: ["Guaranteed margins"], visualStrength: "moderate", proofTypes: ["canonical_product_capture"], recommendedCaptureStates: [capture("intake", "Collection intake", "Synthetic collection purchase review state.")], ctaOptions: ["Explore Collection Buying"], landingUrl: "/dashboard/collection-buying", source: "product_registry" },
  { id: "tournaments", name: "Tournaments", slug: "tournaments", route: "/dashboard/tournaments", audiences: ["local_game_store"], problemsSolved: ["manual event operations"], capabilities: ["run tournament operations"], approvedClaims: [], disallowedClaims: ["Guaranteed attendance"], visualStrength: "moderate", proofTypes: ["canonical_product_capture"], recommendedCaptureStates: [capture("event", "Event operations", "Synthetic tournament round and registration state.")], ctaOptions: ["See Tournaments"], landingUrl: "/dashboard/tournaments", source: "product_registry" },
  { id: "showcase", name: "Showcase", slug: "showcase", route: "/dashboard/showcase", audiences: ["local_game_store", "multi_location_store"], problemsSolved: ["limited in-store discovery"], capabilities: ["present a store showcase workflow"], approvedClaims: [], disallowedClaims: ["Guaranteed sales"], visualStrength: "moderate", proofTypes: ["canonical_product_capture"], recommendedCaptureStates: [capture("kiosk", "Showcase kiosk", "Synthetic showcase display state.")], ctaOptions: ["See Showcase"], landingUrl: "/dashboard/showcase", source: "product_registry" },
  { id: "marketplaces", name: "Marketplace Workflows", slug: "marketplaces", route: "/dashboard/marketplaces", audiences: ["high_volume_online_seller", "multi_location_store"], problemsSolved: ["disconnected marketplace operations"], capabilities: ["review marketplace workflows"], approvedClaims: [], disallowedClaims: ["Guaranteed marketplace sales"], visualStrength: "limited", proofTypes: ["canonical_product_capture"], recommendedCaptureStates: [capture("connections", "Marketplace connections", "Synthetic marketplace connection state.")], ctaOptions: ["Explore Marketplace Workflows"], landingUrl: "/dashboard/marketplaces", source: "product_registry" },
];

export function registryFeatureFor(slug: string) {
  return MARKETING_PRODUCT_REGISTRY.find((feature) => feature.slug === slug) ?? null;
}

export function mergeApprovedFeatureMetadata(feature: ProductMarketingFeature, metadata?: Record<string, unknown> | null): ProductMarketingFeature {
  if (!metadata) return feature;
  return { ...feature, id: typeof metadata.id === "string" ? metadata.id : feature.id, name: typeof metadata.name === "string" ? metadata.name : feature.name, approvedClaims: Array.isArray(metadata.approved_claims) ? metadata.approved_claims.map((value) => typeof value === "string" ? value : typeof value === "object" && value && "claim" in value ? String(value.claim) : "").filter(Boolean) : feature.approvedClaims, disallowedClaims: Array.isArray(metadata.disallowed_claims) ? metadata.disallowed_claims.map((value) => typeof value === "string" ? value : typeof value === "object" && value && "claim" in value ? String(value.claim) : "").filter(Boolean) : feature.disallowedClaims, audiences: Array.isArray(metadata.target_audiences) ? metadata.target_audiences.filter((value): value is string => typeof value === "string") : feature.audiences, problemsSolved: Array.isArray(metadata.problems_solved) ? metadata.problems_solved.filter((value): value is string => typeof value === "string") : feature.problemsSolved, capabilities: Array.isArray(metadata.capabilities) ? metadata.capabilities.filter((value): value is string => typeof value === "string") : feature.capabilities, landingUrl: typeof metadata.landing_url === "string" ? metadata.landing_url : feature.landingUrl, source: "approved_feature_library" };
}
