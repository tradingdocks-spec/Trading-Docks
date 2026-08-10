export const PLAN_PREVIEW_COOKIE = "trading_docks_plan_preview";

export const PREVIEW_PLANS = ["free", "collector", "seller", "store"] as const;

export type PreviewPlan = (typeof PREVIEW_PLANS)[number];

export function isPreviewPlan(value: unknown): value is PreviewPlan {
  return typeof value === "string" && PREVIEW_PLANS.includes(value as PreviewPlan);
}

export function previewPlanLabel(plan: string) {
  return plan === "store"
    ? "Store"
    : `${plan.charAt(0).toUpperCase()}${plan.slice(1)}`;
}
