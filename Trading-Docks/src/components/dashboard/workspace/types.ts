import type { LucideIcon } from "lucide-react";

export type AccountPlan = "starter" | "pro" | "business";
export type DashboardLayoutId =
  | "home"
  | "business"
  | "inventory"
  | "analytics"
  | "automation";

export type WidgetSize = "small" | "medium" | "large" | "wide";

export type WidgetDefinition = {
  id: string;
  title: string;
  description: string;
  module: string;
  minimumPlan: AccountPlan;
  defaultSize: WidgetSize;
  icon: LucideIcon;
};

export type DashboardWidget = {
  id: string;
  size: WidgetSize;
};

