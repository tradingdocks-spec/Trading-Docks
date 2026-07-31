import { PLAN_ENTITLEMENTS, normalizeAccountTier, type AccountTier } from "@/lib/plan-entitlements";

export type PlanFeature = "dashboard" | "inventory" | "deck-vault" | "purchasing" | "card-shows" | "marketplaces" | "orders" | "analytics" | "automation" | "tools" | "business-operations" | "settings";
export const PLAN_RANK: Record<AccountTier, number> = { free: 0, collector: 1, seller: 2, business: 3 };
export const FEATURE_MINIMUM_PLAN: Record<PlanFeature, AccountTier> = {
  dashboard: "free", inventory: "free", "deck-vault": "free",
  purchasing: "seller", marketplaces: "seller", orders: "seller",
  "card-shows": "seller",
  analytics: "seller", automation: "seller",
  tools: "seller",
  "business-operations": "business", settings: "free",
};
export const INVENTORY_LIMITS: Record<AccountTier, number> = {
  free: 500,
  collector: PLAN_ENTITLEMENTS.collector.inventoryLimit,
  seller: PLAN_ENTITLEMENTS.seller.inventoryLimit,
  business: PLAN_ENTITLEMENTS.business.inventoryLimit,
};
export { normalizeAccountTier };
export function hasPlanAccess(plan: AccountTier, feature: PlanFeature) {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MINIMUM_PLAN[feature]];
}
export function minimumPlanName(feature: PlanFeature) {
  return PLAN_ENTITLEMENTS[FEATURE_MINIMUM_PLAN[feature]].name;
}
export function featureForPath(pathname: string): PlanFeature {
  if (pathname.startsWith("/dashboard/deck-vault")) return "deck-vault";
  if (pathname.startsWith("/dashboard/inventory")) return "inventory";
  if (/^\/dashboard\/(purchasing|collection-buying|sealed-buying|bulk-buying|purchase-history|buying-|buylist-intelligence)/.test(pathname)) return "purchasing";
  if (pathname.startsWith("/dashboard/sell-optimizer")) return "marketplaces";
  if (pathname.startsWith("/dashboard/card-shows")) return "card-shows";
  if (pathname.startsWith("/dashboard/marketplaces")) return "marketplaces";
  if (pathname.startsWith("/dashboard/orders")) return "orders";
  if (pathname.startsWith("/dashboard/analytics")) return "analytics";
  if (pathname.startsWith("/dashboard/automation")) return "automation";
  if (pathname.startsWith("/dashboard/tools")) return "tools";
  if (/^\/dashboard\/(calendar|employees|payroll|tasks|vendors|supplies|reports|tournaments|finances)/.test(pathname)) return "business-operations";
  if (pathname.startsWith("/dashboard/settings")) return "settings";
  return "dashboard";
}
