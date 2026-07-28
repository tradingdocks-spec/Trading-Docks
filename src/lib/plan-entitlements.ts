export type AccountTier = "free" | "collector" | "seller" | "business";
export type PlanFeature =
  | "dashboard"
  | "inventory"
  | "deck-vault"
  | "seller-operations"
  | "business-operations";

const PLAN_RANK: Record<AccountTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  business: 3,
};

const FEATURE_PLAN: Record<PlanFeature, AccountTier> = {
  dashboard: "free",
  inventory: "free",
  "deck-vault": "free",
  "seller-operations": "seller",
  "business-operations": "business",
};

export const PLAN_ENTITLEMENTS: Record<
  AccountTier,
  {
    name: string;
    monthlyPrice: number;
    annualMonthlyPrice: number;
    annualPrice: number;
    deckLimit: number | null;
    inventoryLimit: number;
  }
> = {
  free: {
    name: "Free",
    monthlyPrice: 0,
    annualMonthlyPrice: 0,
    annualPrice: 0,
    deckLimit: 10,
    inventoryLimit: 500,
  },
  collector: {
    name: "Collector",
    monthlyPrice: 4.99,
    annualMonthlyPrice: 3.75,
    annualPrice: 44.99,
    deckLimit: 50,
    inventoryLimit: 10_000,
  },
  seller: {
    name: "Seller",
    monthlyPrice: 19.99,
    annualMonthlyPrice: 14.99,
    annualPrice: 179.99,
    deckLimit: null,
    inventoryLimit: 50_000,
  },
  business: {
    name: "Store",
    monthlyPrice: 49.99,
    annualMonthlyPrice: 37.49,
    annualPrice: 449.99,
    deckLimit: null,
    inventoryLimit: 250_000,
  },
};

export function normalizeAccountTier(value: unknown): AccountTier {
  return value === "business" ||
    value === "seller" ||
    value === "collector" ||
    value === "free"
    ? value
    : "free";
}

export function featureForPath(pathname: string): PlanFeature {
  if (pathname.startsWith("/dashboard/deck-vault")) return "deck-vault";
  if (pathname.startsWith("/dashboard/inventory")) return "inventory";

  if (
    [
      "/dashboard/collection-buying",
      "/dashboard/marketplaces",
      "/dashboard/orders",
      "/dashboard/purchasing",
      "/dashboard/purchase-history",
      "/dashboard/bulk-buying",
      "/dashboard/sealed-buying",
      "/dashboard/buying-recommendations",
      "/dashboard/buying-rules",
      "/dashboard/market-intelligence",
      "/dashboard/automation",
    ].some((path) => pathname.startsWith(path))
  ) {
    return "seller-operations";
  }

  if (
    [
      "/dashboard/employees",
      "/dashboard/payroll",
      "/dashboard/vendors",
      "/dashboard/reports",
      "/dashboard/tournaments",
      "/dashboard/finances",
      "/dashboard/organization",
      "/dashboard/supplies",
    ].some((path) => pathname.startsWith(path))
  ) {
    return "business-operations";
  }

  return "dashboard";
}

export function hasPlanAccess(
  plan: AccountTier,
  feature: PlanFeature,
): boolean {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_PLAN[feature]];
}

export function minimumPlanName(feature: PlanFeature): string {
  return PLAN_ENTITLEMENTS[FEATURE_PLAN[feature]].name;
}
