import { normalizeAccountTier, type AccountTier } from "../plan-entitlements.ts";
import { isDeckArchitectRoute, shouldShowDeckArchitectEntry } from "../product-visibility.ts";

export type WebNavigationAudience = AccountTier | "admin";

export type WebNavigationStatus =
  | "implemented"
  | "partially-implemented"
  | "planned";

export type WebNavigationDestination = {
  label: string;
  href: string;
  status: WebNavigationStatus;
};

export const WEB_NAVIGATION_CONTRACT: Record<WebNavigationAudience, WebNavigationDestination[]> = {
  free: [
    { label: "Dashboard", href: "/dashboard", status: "implemented" },
    { label: "Collection", href: "/dashboard/inventory", status: "partially-implemented" },
    { label: "Decks", href: "/dashboard/deck-vault", status: "implemented" },
    { label: "Trade Binder", href: "/dashboard/collector-portfolio", status: "planned" },
    { label: "Portfolio", href: "/dashboard/collector-portfolio", status: "partially-implemented" },
    { label: "Settings", href: "/dashboard/settings", status: "implemented" },
  ],
  collector: [
    { label: "Dashboard", href: "/dashboard", status: "implemented" },
    { label: "Collection", href: "/dashboard/inventory", status: "partially-implemented" },
    { label: "Decks", href: "/dashboard/deck-vault", status: "implemented" },
    { label: "Trade Binder", href: "/dashboard/collector-portfolio", status: "planned" },
    { label: "Portfolio", href: "/dashboard/collector-portfolio", status: "partially-implemented" },
    { label: "Settings", href: "/dashboard/settings", status: "implemented" },
  ],
  seller: [
    { label: "Dashboard", href: "/dashboard", status: "implemented" },
    { label: "Inventory", href: "/dashboard/inventory", status: "implemented" },
    { label: "Deal Desk", href: "/dashboard/purchasing", status: "partially-implemented" },
    { label: "Buying Sessions", href: "/dashboard/collection-buying", status: "implemented" },
    { label: "Marketing", href: "/dashboard/marketing", status: "partially-implemented" },
    { label: "Exports", href: "/dashboard/tools/csv-converter", status: "implemented" },
    { label: "Analytics", href: "/dashboard/analytics", status: "implemented" },
    { label: "Settings", href: "/dashboard/settings", status: "implemented" },
  ],
  store: [
    { label: "Dashboard", href: "/dashboard", status: "implemented" },
    { label: "Inventory", href: "/dashboard/inventory", status: "implemented" },
    { label: "Deal Desk", href: "/dashboard/purchasing", status: "partially-implemented" },
    { label: "Employees", href: "/dashboard/employees", status: "implemented" },
    { label: "Customers", href: "/dashboard/customers", status: "implemented" },
    { label: "Marketing", href: "/dashboard/marketing", status: "partially-implemented" },
    { label: "Operations", href: "/dashboard/tasks", status: "partially-implemented" },
    { label: "Analytics", href: "/dashboard/analytics", status: "implemented" },
    { label: "Settings", href: "/dashboard/settings", status: "implemented" },
  ],
  admin: [
    { label: "Command Center", href: "/dashboard/admin", status: "implemented" },
    { label: "Users", href: "/dashboard/admin", status: "partially-implemented" },
    { label: "Subscriptions", href: "/dashboard/admin", status: "partially-implemented" },
    { label: "Sessions", href: "/dashboard/admin", status: "planned" },
    { label: "System Health", href: "/dashboard/admin", status: "partially-implemented" },
    { label: "Audit Log", href: "/dashboard/admin", status: "partially-implemented" },
    { label: "Plans", href: "/dashboard/admin", status: "partially-implemented" },
    { label: "Feature Flags", href: "/dashboard/admin", status: "partially-implemented" },
  ],
};

export function getWebNavigationContract(accountType: unknown) {
  return WEB_NAVIGATION_CONTRACT[normalizeAccountTier(accountType)].filter((item) =>
    !isDeckArchitectRoute(item.href) || shouldShowDeckArchitectEntry(),
  );
}

export function isWebNavigationActive(pathname: string, href: string) {
  return href === "/dashboard"
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}
