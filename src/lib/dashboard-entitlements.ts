import type { AccountTier } from "@/lib/plan-entitlements";
import {
  hasCapability,
  hasTrustedFullPlatformAccess,
  type ClientSafePlatformAccess,
  type PlatformCapability,
} from "../../mobile/services/platform-access.ts";

export type DashboardLayoutId =
  | "home"
  | "business"
  | "inventory"
  | "analytics"
  | "automation";
export type DashboardWidgetSize = "small" | "medium" | "large";
export type DashboardViewport = "desktop" | "tablet" | "mobile";
export type DashboardWidget = {
  id: string;
  size: DashboardWidgetSize;
};

export const DASHBOARD_WIDGET_MINIMUM_PLAN = {
  "inventory-value": "free",
  "inventory-count": "free",
  "collection-growth": "collector",
  revenue: "seller",
  orders: "seller",
  marketplaces: "seller",
  "listing-queue": "seller",
  automation: "seller",
  "business-calendar": "store",
  team: "store",
  ai: "store",
  supplies: "store",
} as const satisfies Record<string, AccountTier>;

export const DASHBOARD_WIDGET_CAPABILITY = {
  "inventory-value": "collection.read",
  "inventory-count": "collection.read",
  "collection-growth": "analytics.view",
  revenue: "orders.manage",
  orders: "orders.manage",
  marketplaces: "marketplaces.manage",
  "listing-queue": "inventory.manage",
  automation: "automation.manage",
  "business-calendar": "events.manage",
  team: "employees.manage",
  ai: "businessIntelligence.view",
  supplies: "supplies.manage",
} as const satisfies Record<string, PlatformCapability>;

const PLAN_RANK: Record<AccountTier, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
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
const VIEWPORTS: DashboardViewport[] = ["desktop", "tablet", "mobile"];

export function canUseDashboardWidget(
  plan: AccountTier,
  widgetId: string,
  access?: ClientSafePlatformAccess,
) {
  const required =
    DASHBOARD_WIDGET_MINIMUM_PLAN[
      widgetId as keyof typeof DASHBOARD_WIDGET_MINIMUM_PLAN
    ];
  if (!required) return false;
  if (access) {
    const capability =
      DASHBOARD_WIDGET_CAPABILITY[
        widgetId as keyof typeof DASHBOARD_WIDGET_CAPABILITY
      ];
    return Boolean(capability && hasCapability(access, capability));
  }
  return PLAN_RANK[plan] >= PLAN_RANK[required];
}

export function availableDashboardLayouts(
  plan: AccountTier,
  access?: ClientSafePlatformAccess,
) {
  if (access && hasTrustedFullPlatformAccess(access)) return ALL_LAYOUTS;
  return plan === "free" || plan === "collector" ? PERSONAL_LAYOUTS : ALL_LAYOUTS;
}

export function sanitizeDashboardLayoutsForPlan(
  value: unknown,
  plan: AccountTier,
  access?: ClientSafePlatformAccess,
): Partial<Record<DashboardLayoutId, DashboardWidget[]>> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};

  const allowedLayouts = availableDashboardLayouts(plan, access);
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
        !canUseDashboardWidget(plan, candidate.id, access)
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

export function sanitizeResponsiveDashboardLayoutsForPlan(
  value: unknown,
  plan: AccountTier,
  access?: ClientSafePlatformAccess,
): Record<
  DashboardViewport,
  Partial<Record<DashboardLayoutId, DashboardWidget[]>>
> {
  const record =
    value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  const isResponsive = VIEWPORTS.some((viewport) => viewport in record);
  const legacy = sanitizeDashboardLayoutsForPlan(value, plan, access);

  return {
    desktop: isResponsive
      ? sanitizeDashboardLayoutsForPlan(record.desktop, plan, access)
      : legacy,
    tablet: isResponsive
      ? sanitizeDashboardLayoutsForPlan(record.tablet, plan, access)
      : legacy,
    mobile: isResponsive
      ? sanitizeDashboardLayoutsForPlan(record.mobile, plan, access)
      : legacy,
  };
}
