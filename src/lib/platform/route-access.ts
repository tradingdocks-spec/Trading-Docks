import {
  CAPABILITY_REGISTRY,
  hasCapability,
  type ClientSafePlatformAccess,
  type PlatformAccessContext,
  type PlatformCapability,
  type WorkspaceRole,
} from "../../../mobile/services/platform-access.ts";
import { MEMBERSHIP_PLANS, type MembershipTier } from "../membership-catalog.ts";

export type RouteAccessKind =
  | "public"
  | "authenticated"
  | "capability"
  | "workspace"
  | "platform-admin"
  | "development-only";

export type RouteAccessRule = {
  id: string;
  pattern: RegExp;
  kind: RouteAccessKind;
  capability?: PlatformCapability;
  minimumWorkspaceRole?: WorkspaceRole;
  label: string;
};

export const ROUTE_ACCESS_REGISTRY: RouteAccessRule[] = [
  { id: "home", pattern: /^\/$/, kind: "public", label: "Home" },
  { id: "pricing", pattern: /^\/pricing\/?$/, kind: "public", label: "Pricing" },
  { id: "auth", pattern: /^\/(sign-in|sign-up|forgot-password|update-password)\/?$/, kind: "public", label: "Authentication" },
  { id: "dashboard", pattern: /^\/dashboard\/?$/, kind: "authenticated", label: "Dashboard" },
  { id: "inventory", pattern: /^\/dashboard\/inventory(\/|$)/, kind: "capability", capability: "collection.read", label: "Inventory" },
  { id: "collection", pattern: /^\/dashboard\/collection(\/|$)/, kind: "capability", capability: "collection.read", label: "Collection" },
  { id: "orders", pattern: /^\/dashboard\/orders(\/|$)/, kind: "capability", capability: "orders.manage", label: "Orders" },
  { id: "analytics", pattern: /^\/dashboard\/analytics(\/|$)/, kind: "capability", capability: "analytics.view", label: "Analytics" },
  { id: "crm", pattern: /^\/dashboard\/customers(\/|$)/, kind: "capability", capability: "crm.manage", label: "Customer CRM" },
  { id: "employees", pattern: /^\/dashboard\/employees(\/|$)/, kind: "capability", capability: "employees.manage", label: "Employees" },
  { id: "settings", pattern: /^\/dashboard\/settings(\/|$)/, kind: "authenticated", label: "Settings" },
  { id: "admin", pattern: /^\/dashboard\/admin(\/|$)/, kind: "platform-admin", capability: "platform.admin", label: "Command Center" },
  { id: "dev-design-system", pattern: /^\/dev\/design-system(\/|$)/, kind: "development-only", label: "Design System" },
];

const DEFAULT_DASHBOARD_RULE: RouteAccessRule = {
  id: "dashboard-fallback",
  pattern: /^\/dashboard(\/|$)/,
  kind: "capability",
  capability: "businessIntelligence.view",
  label: "Protected dashboard route",
};

export function routeAccessRuleForPath(pathname: string) {
  return ROUTE_ACCESS_REGISTRY.find((rule) => rule.pattern.test(pathname))
    ?? (pathname.startsWith("/dashboard") ? DEFAULT_DASHBOARD_RULE : null);
}

export function hasRouteAccess(
  access: PlatformAccessContext | ClientSafePlatformAccess,
  pathname: string,
  env: "development" | "production" | "test" = "production",
) {
  const rule = routeAccessRuleForPath(pathname);
  if (!rule) return true;
  if (rule.kind === "public") return true;
  if (rule.kind === "development-only") return env !== "production";
  if (!access.authenticated || access.suspended) return false;
  if (rule.kind === "authenticated") return true;
  if (rule.capability) return hasCapability(access, rule.capability);
  return false;
}

export function requiredMembershipForRoute(pathname: string): MembershipTier | null {
  const rule = routeAccessRuleForPath(pathname);
  if (!rule?.capability) return null;
  return CAPABILITY_REGISTRY[rule.capability].minimumTier ?? null;
}

export function requiredMembershipLabelForRoute(pathname: string) {
  const tier = requiredMembershipForRoute(pathname);
  return tier ? MEMBERSHIP_PLANS[tier].name : null;
}

export function routeAccessLabel(pathname: string) {
  return routeAccessRuleForPath(pathname)?.label ?? "This route";
}
