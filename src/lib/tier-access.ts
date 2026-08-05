import {
  PLAN_ENTITLEMENTS,
  normalizeAccountTier,
  type AccountTier,
} from "@/lib/plan-entitlements";

export type PlanFeature =
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
  | "admin";

export const PLAN_RANK: Record<AccountTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

export const FEATURE_MINIMUM_PLAN: Record<PlanFeature, AccountTier> = {
  dashboard: "free",
  inventory: "free",
  "deck-vault": "free",
  "collector-analytics": "collector",
  "csv-tools": "collector",
  purchasing: "seller",
  crm: "seller",
  selling: "seller",
  marketplaces: "seller",
  orders: "seller",
  "card-shows": "seller",
  automation: "seller",
  "business-intelligence": "store",
  "business-operations": "store",
  settings: "free",
  support: "free",
  admin: "store",
};

export const FEATURE_LABEL: Record<PlanFeature, string> = {
  dashboard: "Dashboard",
  inventory: "Inventory",
  "deck-vault": "Deck Vault",
  "collector-analytics": "Analytics",
  "csv-tools": "CSV tools",
  purchasing: "Purchasing",
  crm: "Customer CRM",
  selling: "Selling",
  marketplaces: "Marketplace integrations",
  orders: "Orders",
  "card-shows": "Card Shows",
  automation: "Automation",
  "business-intelligence": "Business Intelligence",
  "business-operations": "Store operations",
  settings: "Settings",
  support: "Feedback and support",
  admin: "Admin Control Center",
};

export const INVENTORY_LIMITS: Record<AccountTier, number | null> = {
  free: PLAN_ENTITLEMENTS.free.inventoryLimit,
  collector: PLAN_ENTITLEMENTS.collector.inventoryLimit,
  seller: PLAN_ENTITLEMENTS.seller.inventoryLimit,
  store: PLAN_ENTITLEMENTS.store.inventoryLimit,
};

export const DECK_LIMITS: Record<AccountTier, number | null> = {
  free: PLAN_ENTITLEMENTS.free.deckLimit,
  collector: PLAN_ENTITLEMENTS.collector.deckLimit,
  seller: PLAN_ENTITLEMENTS.seller.deckLimit,
  store: PLAN_ENTITLEMENTS.store.deckLimit,
};

export type PlanCapability = {
  feature: PlanFeature;
  label: string;
  minimumPlan: AccountTier;
  routes: string[];
  summary: string;
};

export const PLAN_CAPABILITIES: PlanCapability[] = [
  {
    feature: "dashboard",
    label: "Dashboard",
    minimumPlan: "free",
    routes: ["/dashboard", "/dashboard/plans"],
    summary: "Personal workspace overview and plan management.",
  },
  {
    feature: "inventory",
    label: "Inventory",
    minimumPlan: "free",
    routes: ["/dashboard/inventory"],
    summary: "Inventory storage, search, and organization within plan limits.",
  },
  {
    feature: "deck-vault",
    label: "Deck Vault",
    minimumPlan: "free",
    routes: ["/dashboard/deck-vault"],
    summary: "Deck storage and deck-building tools within plan limits.",
  },
  {
    feature: "collector-analytics",
    label: "Analytics",
    minimumPlan: "collector",
    routes: ["/dashboard/analytics"],
    summary: "Collection value, growth, and portfolio analytics.",
  },
  {
    feature: "csv-tools",
    label: "CSV Conversion Engine",
    minimumPlan: "collector",
    routes: ["/dashboard/tools/csv-converter"],
    summary: "CSV import, export, conversion, and catalog preparation.",
  },
  {
    feature: "purchasing",
    label: "Purchasing",
    minimumPlan: "seller",
    routes: [
      "/dashboard/purchasing",
      "/dashboard/card-photo-scanner",
      "/dashboard/collection-buying",
      "/dashboard/sealed-buying",
      "/dashboard/bulk-buying",
      "/dashboard/purchase-history",
      "/dashboard/buying-rules",
      "/dashboard/buying-recommendations",
      "/dashboard/buylist-intelligence",
      "/dashboard/buylist-connections",
      "/dashboard/market-intelligence",
    ],
    summary: "Buying workflows, acquisition intelligence, and buylist tools.",
  },
  {
    feature: "crm",
    label: "Customer CRM",
    minimumPlan: "seller",
    routes: ["/dashboard/customers"],
    summary: "Customer records, store credit, loyalty, and marketing data.",
  },
  {
    feature: "selling",
    label: "Sell Optimizer",
    minimumPlan: "seller",
    routes: [
      "/dashboard/mission-control-preview",
      "/dashboard/seller-launch",
      "/dashboard/sell-optimizer",
    ],
    summary: "Pricing, listing, and sales optimization.",
  },
  {
    feature: "marketplaces",
    label: "Marketplaces",
    minimumPlan: "seller",
    routes: ["/dashboard/marketplaces"],
    summary: "Marketplace connections and channel synchronization.",
  },
  {
    feature: "orders",
    label: "Orders",
    minimumPlan: "seller",
    routes: ["/dashboard/orders"],
    summary: "Universal order processing, reconciliation, and fulfillment.",
  },
  {
    feature: "card-shows",
    label: "Card Shows",
    minimumPlan: "seller",
    routes: ["/dashboard/card-shows"],
    summary: "Vendor events, show planning, and mobile selling workflows.",
  },
  {
    feature: "automation",
    label: "Automation",
    minimumPlan: "seller",
    routes: ["/dashboard/automation"],
    summary: "Seller workflow and marketplace automation.",
  },
  {
    feature: "business-intelligence",
    label: "Business Intelligence",
    minimumPlan: "store",
    routes: ["/dashboard/reports"],
    summary: "Advanced store reporting and operational dashboards.",
  },
  {
    feature: "business-operations",
    label: "Store Operations",
    minimumPlan: "store",
    routes: [
      "/dashboard/tasks",
      "/dashboard/calendar",
      "/dashboard/tournaments",
      "/dashboard/vendors",
      "/dashboard/supplies",
      "/dashboard/employees",
      "/dashboard/payroll",
      "/dashboard/finances",
      "/dashboard/organization",
    ],
    summary: "Team, vendor, tournament, finance, and store operations.",
  },
  {
    feature: "settings",
    label: "Settings",
    minimumPlan: "free",
    routes: ["/dashboard/settings"],
    summary: "Account, workspace, and preference management.",
  },
  {
    feature: "support",
    label: "Feedback & Support",
    minimumPlan: "free",
    routes: ["/dashboard/feedback"],
    summary: "Product feedback and support access.",
  },
  {
    feature: "admin",
    label: "Admin Control Center",
    minimumPlan: "store",
    routes: ["/dashboard/admin"],
    summary: "Trading Docks owner administration; owner authorization is also required.",
  },
];

const ROUTE_RULES: Array<{ test: (pathname: string) => boolean; feature: PlanFeature }> = [
  { test: (p) => p === "/dashboard" || p.startsWith("/dashboard/plans"), feature: "dashboard" },
  { test: (p) => p.startsWith("/dashboard/inventory"), feature: "inventory" },
  { test: (p) => p.startsWith("/dashboard/deck-vault"), feature: "deck-vault" },
  { test: (p) => p.startsWith("/dashboard/analytics"), feature: "collector-analytics" },
  { test: (p) => p.startsWith("/dashboard/tools/csv-converter"), feature: "csv-tools" },
  { test: (p) => p.startsWith("/dashboard/customers"), feature: "crm" },
  {
    test: (p) =>
      /^\/dashboard\/(purchasing|card-photo-scanner|collection-buying|sealed-buying|bulk-buying|purchase-history|buying-rules|buying-recommendations|buylist-intelligence|buylist-connections|market-intelligence)(\/|$)/.test(p),
    feature: "purchasing",
  },
  {
    test: (p) =>
      p.startsWith("/dashboard/mission-control-preview") ||
      p.startsWith("/dashboard/seller-launch") ||
      p.startsWith("/dashboard/sell-optimizer"),
    feature: "selling",
  },
  { test: (p) => p.startsWith("/dashboard/marketplaces"), feature: "marketplaces" },
  { test: (p) => p.startsWith("/dashboard/orders"), feature: "orders" },
  { test: (p) => p.startsWith("/dashboard/card-shows"), feature: "card-shows" },
  { test: (p) => p.startsWith("/dashboard/automation"), feature: "automation" },
  { test: (p) => p.startsWith("/dashboard/reports"), feature: "business-intelligence" },
  {
    test: (p) =>
      /^\/dashboard\/(tasks|calendar|tournaments|vendors|supplies|employees|payroll|finances|organization)(\/|$)/.test(p),
    feature: "business-operations",
  },
  { test: (p) => p.startsWith("/dashboard/settings"), feature: "settings" },
  { test: (p) => p.startsWith("/dashboard/feedback"), feature: "support" },
  { test: (p) => p.startsWith("/dashboard/admin"), feature: "admin" },
];

export { normalizeAccountTier };

export function hasPlanAccess(plan: AccountTier, feature: PlanFeature) {
  return PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MINIMUM_PLAN[feature]];
}

export function minimumPlanName(feature: PlanFeature) {
  return PLAN_ENTITLEMENTS[FEATURE_MINIMUM_PLAN[feature]].name;
}

export function featureForPath(pathname: string): PlanFeature {
  const matched = ROUTE_RULES.find(({ test }) => test(pathname));
  // Fail closed for future dashboard routes instead of silently granting Free.
  return matched?.feature ?? "business-operations";
}

export function featuresForPlan(plan: AccountTier) {
  return PLAN_CAPABILITIES.filter((capability) =>
    hasPlanAccess(plan, capability.feature),
  );
}
