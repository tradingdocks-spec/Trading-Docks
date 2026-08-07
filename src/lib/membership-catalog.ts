export type AccountType = "free" | "collector" | "seller" | "store";
export type MembershipTier = AccountType;
export type BillingCycle = "monthly" | "annual";
export type BillingStatus =
  | "free"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid"
  | "paused"
  | "suspended"
  | "unknown";

export type MembershipEntitlementKey =
  | "card-scanner"
  | "basic-collection-tools"
  | "unlimited-cards"
  | "unlimited-decks"
  | "collection-value"
  | "price-history"
  | "financial-insights"
  | "storage-locations"
  | "trade-binder"
  | "wishlist"
  | "market-signals"
  | "deal-desk"
  | "buying-profiles"
  | "buying-sessions"
  | "trade-calculator"
  | "card-show-tools"
  | "sealed-evaluator"
  | "csv-email-export"
  | "web-workspace"
  | "employee-accounts"
  | "shared-buying-profiles"
  | "approval-limits"
  | "shared-sessions"
  | "customer-facing-trade-summaries"
  | "shared-inventory-access"
  | "store-operations-tools";

export type RouteEntitlementKey =
  | "dashboard"
  | "inventory"
  | "deck-vault"
  | "collector-analytics"
  | "csv-tools"
  | "purchasing"
  | "crm"
  | "selling"
  | "marketplaces"
  | "orders"
  | "card-shows"
  | "automation"
  | "business-intelligence"
  | "business-operations"
  | "settings"
  | "support"
  | "admin.command-center";

export type EntitlementKey = MembershipEntitlementKey | RouteEntitlementKey;

export type EmployeeAccountLimit =
  | { kind: "not_included" }
  | { kind: "pending_configuration" };

export type PlanLimits = {
  cardLimit: number | null;
  deckLimit: number | null;
  employeeAccounts: EmployeeAccountLimit;
};

export type MembershipPlan = {
  id: MembershipTier;
  name: string;
  monthlyPrice: number;
  annualPrice: number;
  limits: PlanLimits;
  headlineFeatures: string[];
  features: string[];
  entitlementKeys: EntitlementKey[];
};

const FREE_ENTITLEMENTS: EntitlementKey[] = [
  "dashboard",
  "inventory",
  "deck-vault",
  "settings",
  "support",
  "card-scanner",
  "basic-collection-tools",
];

const COLLECTOR_ENTITLEMENTS: EntitlementKey[] = [
  ...FREE_ENTITLEMENTS,
  "collector-analytics",
  "csv-tools",
  "unlimited-cards",
  "unlimited-decks",
  "collection-value",
  "price-history",
  "financial-insights",
  "storage-locations",
  "trade-binder",
  "wishlist",
  "market-signals",
];

const SELLER_ENTITLEMENTS: EntitlementKey[] = [
  ...COLLECTOR_ENTITLEMENTS,
  "purchasing",
  "crm",
  "selling",
  "marketplaces",
  "orders",
  "card-shows",
  "automation",
  "deal-desk",
  "buying-profiles",
  "buying-sessions",
  "trade-calculator",
  "card-show-tools",
  "sealed-evaluator",
  "csv-email-export",
  "web-workspace",
];

const STORE_ENTITLEMENTS: EntitlementKey[] = [
  ...SELLER_ENTITLEMENTS,
  "business-intelligence",
  "business-operations",
  "employee-accounts",
  "shared-buying-profiles",
  "approval-limits",
  "shared-sessions",
  "customer-facing-trade-summaries",
  "shared-inventory-access",
  "store-operations-tools",
];

export const MEMBERSHIP_TIER_ORDER: Record<MembershipTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

export const MEMBERSHIP_PLANS: Record<MembershipTier, MembershipPlan> = {
  free: {
    id: "free",
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    limits: {
      cardLimit: 500,
      deckLimit: 5,
      employeeAccounts: { kind: "not_included" },
    },
    headlineFeatures: ["500 cards", "5 decks", "Card scanner"],
    features: ["500-card limit", "5-deck limit", "Card scanner", "Basic collection tools"],
    entitlementKeys: FREE_ENTITLEMENTS,
  },
  collector: {
    id: "collector",
    name: "Collector",
    monthlyPrice: 4.99,
    annualPrice: 49.99,
    limits: {
      cardLimit: null,
      deckLimit: null,
      employeeAccounts: { kind: "not_included" },
    },
    headlineFeatures: ["Unlimited cards and decks", "Financial insights", "Market signals"],
    features: [
      "Everything in Free",
      "Unlimited cards and decks",
      "Collection value and price history",
      "Financial insights",
      "Storage locations",
      "Trade binder",
      "Wishlist",
      "Market signals",
    ],
    entitlementKeys: COLLECTOR_ENTITLEMENTS,
  },
  seller: {
    id: "seller",
    name: "Seller",
    monthlyPrice: 14.99,
    annualPrice: 149.99,
    limits: {
      cardLimit: null,
      deckLimit: null,
      employeeAccounts: { kind: "not_included" },
    },
    headlineFeatures: ["Deal Desk", "Buying sessions", "Full web workspace"],
    features: [
      "Everything in Collector",
      "Deal Desk",
      "Buying profiles",
      "Buying sessions",
      "Trade calculator",
      "Card-show tools",
      "Sealed evaluator",
      "CSV/email export",
      "Full web workspace access",
    ],
    entitlementKeys: SELLER_ENTITLEMENTS,
  },
  store: {
    id: "store",
    name: "Store",
    monthlyPrice: 49.99,
    annualPrice: 499.99,
    limits: {
      cardLimit: null,
      deckLimit: null,
      employeeAccounts: { kind: "pending_configuration" },
    },
    headlineFeatures: ["Employee accounts", "Shared workflows", "Store operations"],
    features: [
      "Everything in Seller",
      "Employee accounts",
      "Shared buying profiles",
      "Approval limits",
      "Shared sessions",
      "Customer-facing trade summaries",
      "Shared inventory access",
      "Store operations tools",
    ],
    entitlementKeys: STORE_ENTITLEMENTS,
  },
};

export function normalizeMembershipTier(value: unknown): MembershipTier {
  if (value === "business") return "store";
  return value === "collector" || value === "seller" || value === "store"
    ? value
    : "free";
}

export function normalizeBillingStatus(value: unknown): BillingStatus {
  return value === "trialing" ||
    value === "active" ||
    value === "past_due" ||
    value === "canceled" ||
    value === "incomplete" ||
    value === "incomplete_expired" ||
    value === "unpaid" ||
    value === "paused" ||
    value === "suspended"
    ? value
    : value === "free"
      ? "free"
      : "unknown";
}

export function annualSavings(tier: MembershipTier) {
  const plan = MEMBERSHIP_PLANS[tier];
  return Number(Math.max(0, plan.monthlyPrice * 12 - plan.annualPrice).toFixed(2));
}

export function getMembershipPlan(tier: unknown) {
  return MEMBERSHIP_PLANS[normalizeMembershipTier(tier)];
}

export function hasMembershipEntitlement(tier: unknown, entitlement: EntitlementKey) {
  return getMembershipPlan(tier).entitlementKeys.includes(entitlement);
}
