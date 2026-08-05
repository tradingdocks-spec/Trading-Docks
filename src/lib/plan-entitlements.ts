import {
  MEMBERSHIP_PLANS,
  annualMonthlyPrice,
  normalizeMembershipTier,
  type MembershipTier,
} from "@/lib/membership-catalog";

export type AccountTier = MembershipTier;
export type PlanFeature =
  | "dashboard"
  | "inventory"
  | "deck-vault"
  | "seller-operations"
  | "business-operations";
type PlanEntitlement = {
  name: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualPrice: number;
  deckLimit: number | null;
  inventoryLimit: number | null;
};

export const PLAN_RANK: Record<AccountTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

const FEATURE_PLAN: Record<PlanFeature, AccountTier> = {
  dashboard: "free",
  inventory: "free",
  "deck-vault": "free",
  "seller-operations": "seller",
  "business-operations": "store",
};

export const PLAN_ENTITLEMENTS: Record<AccountTier, PlanEntitlement> = {
  free: planEntitlement("free"),
  collector: planEntitlement("collector"),
  seller: planEntitlement("seller"),
  store: planEntitlement("store"),
};

export function normalizeAccountTier(value: unknown): AccountTier {
  return normalizeMembershipTier(value);
}

export function minimumPlanForFeature(feature: PlanFeature) {
  return FEATURE_PLAN[feature];
}

function planEntitlement(tier: AccountTier) {
  const plan = MEMBERSHIP_PLANS[tier];
  return {
    name: plan.name,
    monthlyPrice: plan.monthlyPrice,
    annualMonthlyPrice: annualMonthlyPrice(tier),
    annualPrice: plan.annualPrice,
    deckLimit: plan.limits.deckLimit,
    inventoryLimit: plan.limits.cardLimit,
  };
}

// Route-level access is centralized in `src/lib/tier-access.ts`.
