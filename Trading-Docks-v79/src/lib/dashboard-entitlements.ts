import type { AccountTier } from "@/lib/plan-entitlements";

export type DashboardLayoutId =
  | "home"
  | "business"
  | "inventory"
  | "analytics"
  | "automation";
export type DashboardWidgetSize = "small" | "medium" | "large";
export type DashboardWidget = {
  id: string;
  size: DashboardWidgetSize;
};

export const DASHBOARD_WIDGET_MINIMUM_PLAN = {
  "inventory-value": "free",
  "inventory-count": "free",
  "collection-growth": "free",
  revenue: "seller",
  orders: "seller",
  marketplaces: "seller",
  "listing-queue": "seller",
  automation: "seller",
  "business-calendar": "business",
  team: "business",
  ai: "business",
  supplies: "business",
} as const satisfies Record<string, AccountTier>;

const PLAN_RANK: Record<AccountTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  business: 3,
};

const PERSONAL_LAYOUTS = new Set<DashboardLayoutId>([
  "home",
  "inventory",
  "analytics",
]);
const ALL_LAYOUTS = new Set<DashboardLayoutId>([
  "home",
  "business",
  "inventory",
  "analytics",
  "automation",
]);
const VALID_SIZES = new Set<DashboardWidgetSize>(["small", "medium", "large"]);

export function canUseDashboardWidget(plan: AccountTier, widgetId: string) {
  const required =
    DASHBOARD_WIDGET_MINIMUM_PLAN[
      widgetId as keyof typeof DASHBOARD_WIDGET_MINIMUM_PLAN
    ];
  return Boolean(required && PLAN_RANK[plan] >= PLAN_RANK[required]);
}

export function availableDashboardLayouts(plan: AccountTier) {
  return plan === "free" || plan === "collector" ? PERSONAL_LAYOUTS : ALL_LAYOUTS;
}

export function sanitizeDashboardLayoutsForPlan(
  value: unknown,
  plan: AccountTier,
): Partial<Record<DashboardLayoutId, DashboardWidget[]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const allowedLayouts = availableDashboardLayouts(plan);
  const result: Partial<Record<DashboardLayoutId, DashboardWidget[]>> = {};

  for (const [layoutId, widgets] of Object.entries(value)) {
    if (!allowedLayouts.has(layoutId as DashboardLayoutId) || !Array.isArray(widgets)) {
      continue;
    }

    const seen = new Set<string>();
    result[layoutId as DashboardLayoutId] = widgets.flatMap((widget) => {
      if (!widget || typeof widget !== "object" || Array.isArray(widget)) return [];
      const candidate = widget as { id?: unknown; size?: unknown };
      if (
        typeof candidate.id !== "string" ||
        seen.has(candidate.id) ||
        !canUseDashboardWidget(plan, candidate.id)
      ) {
        return [];
      }

      seen.add(candidate.id);
      return [
        {
          id: candidate.id,
          size: VALID_SIZES.has(candidate.size as DashboardWidgetSize)
            ? (candidate.size as DashboardWidgetSize)
            : "medium",
        },
      ];
    });
  }

  return result;
}

