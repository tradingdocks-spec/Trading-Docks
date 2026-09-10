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
  | "development-only"
  | "blocked";

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
  { id: "legal", pattern: /^\/(privacy|terms|security|robots\.txt|icon\.png|apple-icon\.png)\/?$/, kind: "public", label: "Legal and static routes" },
  { id: "auth", pattern: /^\/(sign-in|sign-up|forgot-password|update-password|auth\/callback|onboarding)\/?$/, kind: "public", label: "Authentication" },
  { id: "collector-profile-public", pattern: /^\/collectors(\/|$)/, kind: "public", label: "Public collector profile" },
  { id: "share", pattern: /^\/share\/(binder|portfolio)(\/|$)/, kind: "public", label: "Shared collection link" },
  { id: "dashboard", pattern: /^\/dashboard\/?$/, kind: "authenticated", label: "Dashboard" },
  { id: "showcase", pattern: /^\/dashboard\/showcase(\/|$)/, kind: "authenticated", label: "Showcase" },
  { id: "dashboard-plans", pattern: /^\/dashboard\/(plans|billing\/success)(\/|$)/, kind: "authenticated", label: "Plans and billing" },
  { id: "dashboard-chaos-sort-redirect", pattern: /^\/dashboard\/imports\/chaos-sort\/?$/, kind: "authenticated", label: "Chaos Sort redirect" },
  { id: "card-workspace", pattern: /^\/dashboard\/cards(\/|$)/, kind: "capability", capability: "collection.read", label: "Card Workspace" },
  { id: "inventory", pattern: /^\/dashboard\/inventory(\/|$)/, kind: "capability", capability: "collection.read", label: "Inventory" },
  { id: "label-studio", pattern: /^\/dashboard\/label-studio(\/|$)/, kind: "capability", capability: "label.view", label: "Label Studio" },
  { id: "collection", pattern: /^\/dashboard\/collection(\/|$)/, kind: "capability", capability: "collection.read", label: "Collection" },
  { id: "deck-vault", pattern: /^\/dashboard\/deck-vault(\/|$)/, kind: "capability", capability: "deck.manage", label: "Deck Vault" },
  { id: "deck-architect", pattern: /^\/dashboard\/deck-architect(\/|$)/, kind: "capability", capability: "deck.manage", label: "Deck Architect" },
  { id: "collector-portfolio", pattern: /^\/dashboard\/collector-portfolio(\/|$)/, kind: "capability", capability: "analytics.view", label: "Collector Portfolio" },
  {
    id: "buying",
    pattern: /^\/dashboard\/(purchasing|purchasing-intelligence|card-photo-scanner|collection-buying|sealed-buying|bulk-buying|purchase-history|buying-rules|buying-recommendations|buylist-intelligence|buylist-connections|market-intelligence|precon-intelligence)(\/|$)/,
    kind: "capability",
    capability: "buying.manage",
    label: "Buying workflows",
  },
  {
    id: "buying-canonical-aliases",
    pattern: /^\/dashboard\/purchasing\/(collection-buying|sealed|bulk|history|rules|ai)(\/|$)/,
    kind: "capability",
    capability: "buying.manage",
    label: "Buying workflows",
  },
  { id: "card-shows", pattern: /^\/dashboard\/card-shows(\/|$)/, kind: "capability", capability: "buying.manage", label: "Card Shows" },
  { id: "marketplaces", pattern: /^\/dashboard\/marketplaces(\/|$)/, kind: "capability", capability: "marketplaces.manage", label: "Marketplaces" },
  { id: "selling", pattern: /^\/dashboard\/(sell-optimizer|seller-launch|mission-control-preview)(\/|$)/, kind: "capability", capability: "orders.manage", label: "Selling" },
  { id: "orders", pattern: /^\/dashboard\/orders(\/|$)/, kind: "capability", capability: "orders.manage", label: "Orders" },
  { id: "analytics", pattern: /^\/dashboard\/analytics(\/|$)/, kind: "capability", capability: "analytics.view", label: "Analytics" },
  { id: "automation", pattern: /^\/dashboard\/automation(\/|$)/, kind: "capability", capability: "automation.manage", label: "Automation" },
  { id: "tools", pattern: /^\/dashboard\/(tools|tools\/csv-converter|csv-converter)(\/|$)/, kind: "capability", capability: "csv.export", label: "CSV tools" },
  { id: "crm", pattern: /^\/dashboard\/(customers|crm|marketing)(\/|$)/, kind: "capability", capability: "crm.manage", label: "CRM and Marketing" },
  { id: "business", pattern: /^\/dashboard\/business(\/|$)/, kind: "capability", capability: "businessIntelligence.view", label: "Business" },
  { id: "calendar", pattern: /^\/dashboard\/calendar(\/|$)/, kind: "capability", capability: "events.manage", label: "Calendar" },
  { id: "employees", pattern: /^\/dashboard\/employees(\/|$)/, kind: "capability", capability: "employees.manage", label: "Employees" },
  { id: "payroll", pattern: /^\/dashboard\/payroll(\/|$)/, kind: "capability", capability: "payroll.manage", label: "Payroll" },
  { id: "tasks", pattern: /^\/dashboard\/tasks(\/|$)/, kind: "capability", capability: "workspace.manage", label: "Tasks" },
  { id: "vendors", pattern: /^\/dashboard\/vendors(\/|$)/, kind: "capability", capability: "vendors.manage", label: "Vendors" },
  { id: "supplies", pattern: /^\/dashboard\/(supplies|supply-orders)(\/|$)/, kind: "capability", capability: "supplies.manage", label: "Supply Orders" },
  { id: "tournaments", pattern: /^\/dashboard\/tournaments(\/|$)/, kind: "capability", capability: "events.manage", label: "Tournaments" },
  { id: "reports", pattern: /^\/dashboard\/(reports|business-intelligence)(\/|$)/, kind: "capability", capability: "businessIntelligence.view", label: "Business Intelligence" },
  { id: "finances", pattern: /^\/dashboard\/finances(\/|$)/, kind: "capability", capability: "finances.manage", label: "Finances" },
  { id: "organization", pattern: /^\/dashboard\/organization(\/|$)/, kind: "capability", capability: "workspace.manage", label: "Organization" },
  { id: "settings", pattern: /^\/dashboard\/settings(\/|$)/, kind: "authenticated", label: "Settings" },
  { id: "profile", pattern: /^\/dashboard\/profile(\/|$)/, kind: "authenticated", label: "Profile" },
  { id: "support", pattern: /^\/dashboard\/feedback(\/|$)/, kind: "capability", capability: "support.access", label: "Feedback and Support" },
  { id: "admin", pattern: /^\/dashboard\/admin(\/|$)/, kind: "platform-admin", capability: "platform.admin", label: "Command Center" },
  { id: "dev", pattern: /^\/dev(\/|$)/, kind: "development-only", label: "Development tools" },
];

const DEFAULT_DASHBOARD_RULE: RouteAccessRule = {
  id: "dashboard-fallback",
  pattern: /^\/dashboard(\/|$)/,
  kind: "blocked",
  label: "Unclassified dashboard route",
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
  if (rule.kind === "blocked") return false;
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
