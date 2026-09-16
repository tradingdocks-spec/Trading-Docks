import {
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  CircleDollarSign,
  DatabaseZap,
  ClipboardList,
  FileBarChart2,
  FileSpreadsheet,
  Gem,
  History,
  LayoutDashboard,
  LibraryBig,
  MonitorSmartphone,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  Palette,
  Rocket,
  Percent,
  MessageSquarePlus,
  Scale,
  Settings,
  ShoppingBag,
  ScanSearch,
  ScanLine,
  ShieldCheck,
  Store,
  Tags,
  Trophy,
  Truck,
  Users,
  ContactRound,
  WalletCards,
} from "lucide-react";

import {
  hasCapability,
  hasTrustedFullPlatformAccess,
  normalizeAccountType,
  type ClientSafePlatformAccess,
  type AccountType,
} from "../../../mobile/services/platform-access.ts";
import { LABEL_STUDIO_ROUTE } from "../../lib/label-studio/routes.ts";

export type NavigationItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export type NavigationSection = {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href?: string;
  children: NavigationItem[];
};

export const PRIMARY_NAV: NavigationItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/inventory",
    label: "Inventory",
    icon: Boxes,
  },
  {
    href: "/dashboard/showcase",
    label: "Showcase",
    icon: MonitorSmartphone,
  },
  {
    href: "/dashboard/collector-portfolio",
    label: "Collector Portfolio",
    icon: Palette,
  },
  {
    href: "/dashboard/deck-vault",
    label: "Deck Vault",
    icon: LibraryBig,
  },
];

export const CRM_NAV: NavigationItem[] = [
  {
    href: "/dashboard/customers",
    label: "Customer CRM",
    icon: ContactRound,
  },
];

export const PURCHASING_NAV: NavigationSection = {
  id: "purchasing",
  label: "Acquire",
  icon: PackageSearch,
  href: "/dashboard/purchasing-intelligence",
  children: [
    {
      href: "/dashboard/purchasing-intelligence",
      label: "Purchasing Intelligence",
      icon: PackageSearch,
    },
    {
      href: "/dashboard/card-photo-scanner",
      label: "Card Image Lookup",
      icon: ScanLine,
    },
    {
      href: "/dashboard/collection-buying",
      label: "Collection Buying",
      icon: WalletCards,
    },
    {
      href: "/dashboard/sealed-buying",
      label: "Sealed Product Buying",
      icon: PackageCheck,
    },
    {
      href: "/dashboard/precon-intelligence",
      label: "Precon Breakdowns",
      icon: PackageOpen,
    },
    {
      href: "/dashboard/bulk-buying",
      label: "Bulk Buying",
      icon: Scale,
    },
    {
      href: "/dashboard/purchase-history",
      label: "Purchase History",
      icon: History,
    },
    {
      href: "/dashboard/buying-rules",
      label: "Buying Rules",
      icon: Percent,
    },
    {
      href: "/dashboard/buying-recommendations",
      label: "AI Recommendations",
      icon: BrainCircuit,
    },
    {
      href: "/dashboard/buylist-intelligence",
      label: "Buylist Intelligence",
      icon: ScanSearch,
    },
    {
      href: "/dashboard/buylist-connections",
      label: "Buylist Connections",
      icon: DatabaseZap,
    },
  ],
};

export const PRIMARY_NAV_AFTER_PURCHASING: NavigationItem[] = [
  {
    href: "/dashboard/card-shows",
    label: "Card Shows",
    icon: CalendarRange,
  },
  {
    href: "/dashboard/marketplaces",
    label: "Marketplaces",
    icon: Store,
  },
  {
    href: "/dashboard/sell-optimizer",
    label: "Sell Optimizer",
    icon: CircleDollarSign,
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: ShoppingBag,
  },
  {
    href: "/dashboard/analytics",
    label: "Analytics",
    icon: BarChart3,
  },
  {
    href: "/dashboard/automation",
    label: "Automation",
    icon: Bot,
  },
];

export const SELLING_NAV: NavigationSection = {
  id: "selling",
  label: "Sell",
  icon: CircleDollarSign,
  href: "/dashboard/sell-optimizer",
  children: [
    { href: "/dashboard/seller-launch", label: "Seller Launch", icon: Rocket },
    { href: "/dashboard/sell-optimizer", label: "Sell Optimizer", icon: CircleDollarSign },
    { href: "/dashboard/card-shows", label: "Card Shows", icon: CalendarRange },
    { href: "/dashboard/marketplaces", label: "Marketplaces", icon: Store },
    { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  ],
};

export const INSIGHTS_NAV: NavigationSection = {
  id: "insights",
  label: "Intelligence",
  icon: BarChart3,
  href: "/dashboard/analytics",
  children: [
    { href: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { href: "/dashboard/reports", label: "Business Intelligence", icon: FileBarChart2 },
    { href: "/dashboard/automation", label: "Automation", icon: Bot },
  ],
};

export const OPERATIONS_NAV: NavigationSection = {
  id: "operations",
  label: "Operate",
  icon: BriefcaseBusiness,
  href: "/dashboard/tasks",
  children: [
    { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList },
    { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/dashboard/tournaments", label: "Tournaments", icon: Trophy },
    { href: "/dashboard/vendors", label: "Vendors", icon: Truck },
    { href: LABEL_STUDIO_ROUTE, label: "Label Studio", icon: Tags },
    { href: "/dashboard/supplies", label: "Supply Orders", icon: Gem },
    { href: "/dashboard/employees", label: "Employees", icon: Users },
    { href: "/dashboard/payroll", label: "Payroll", icon: CircleDollarSign },
  ],
};

export const TOOLS_NAV: NavigationItem[] = [
  {
    href: "/dashboard/feedback",
    label: "Feedback & Support",
    icon: MessageSquarePlus,
  },
  {
    href: "/dashboard/tools/csv-converter",
    label: "Import & Export",
    icon: FileSpreadsheet,
  },
];

export const BUSINESS_NAV: NavigationItem[] = [
  {
    href: "/dashboard/calendar",
    label: "Calendar",
    icon: CalendarDays,
  },
  {
    href: "/dashboard/employees",
    label: "Employees",
    icon: Users,
  },
  {
    href: "/dashboard/payroll",
    label: "Payroll",
    icon: CircleDollarSign,
  },
  {
    href: "/dashboard/tasks",
    label: "Tasks",
    icon: ClipboardList,
  },
  {
    href: "/dashboard/vendors",
    label: "Vendors",
    icon: Truck,
  },
  {
    href: "/dashboard/supplies",
    label: "Supply Orders",
    icon: Gem,
  },
  {
    href: "/dashboard/reports",
    label: "Business Intelligence",
    icon: FileBarChart2,
  },
  {
    href: "/dashboard/tournaments",
    label: "Tournaments",
    icon: Trophy,
  },
];

export const SECONDARY_NAV: NavigationItem[] = [
  {
    href: "/dashboard/settings",
    label: "Settings",
    icon: Settings,
  },
];

const ICON_BY_LABEL = {
  Dashboard: LayoutDashboard,
  Collection: Boxes,
  Decks: LibraryBig,
  "Trade Binder": WalletCards,
  Portfolio: Palette,
  Settings,
  Inventory: Boxes,
  "Deal Desk": PackageSearch,
  "Buying Sessions": WalletCards,
  Exports: FileSpreadsheet,
  Analytics: BarChart3,
  Employees: Users,
  Customers: ContactRound,
  Operations: BriefcaseBusiness,
  "Label Studio": Tags,
  "Command Center": ShieldCheck,
  Users,
  Subscriptions: Gem,
  Sessions: CalendarRange,
  "System Health": BarChart3,
  "Audit Log": History,
  Plans: Gem,
  "Feature Flags": Bot,
} satisfies Record<string, React.ComponentType<{ className?: string }>>;

export type AccountAwareNavigationGroup = {
  id: string;
  label?: string;
  items: NavigationItem[];
};

const TIER_RANK: Record<AccountType, number> = {
  free: 0,
  collector: 1,
  seller: 2,
  store: 3,
};

const COLLECTOR_WORKSPACE_NAV: NavigationItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/inventory", label: "Collection", icon: Boxes },
  { href: "/dashboard/deck-vault", label: "Deck Vault", icon: LibraryBig },
  { href: "/dashboard/collector-portfolio", label: "Portfolio", icon: Palette },
];

const ADMIN_NAV: NavigationItem[] = [
  { href: "/dashboard/admin", label: "Command Center", icon: ShieldCheck },
  { href: "/dashboard/admin/catalog/tcgplayer", label: "TCGplayer Catalog", icon: DatabaseZap },
];

function isAtLeast(tier: AccountType, minimum: AccountType) {
  return TIER_RANK[tier] >= TIER_RANK[minimum];
}

function uniqueItems(items: NavigationItem[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = item.href;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isAccessibleOrOwner(
  item: NavigationItem,
  clientAccess?: ClientSafePlatformAccess,
) {
  if (!clientAccess) return true;
  if (hasTrustedFullPlatformAccess(clientAccess)) return true;
  if (item.href === LABEL_STUDIO_ROUTE) return hasCapability(clientAccess, "label.view");
  return true;
}

function group(
  id: string,
  label: string,
  items: NavigationItem[],
  clientAccess?: ClientSafePlatformAccess,
): AccountAwareNavigationGroup | null {
  const visibleItems = uniqueItems(items).filter((item) => isAccessibleOrOwner(item, clientAccess));
  return visibleItems.length ? { id, label, items: visibleItems } : null;
}

export function getAccountAwareNavigationGroups(
  accountType: unknown,
  isOwner: boolean,
  clientAccess?: ClientSafePlatformAccess,
): AccountAwareNavigationGroup[] {
  const tier = normalizeAccountType(accountType);
  const receivesFullSurface = Boolean(clientAccess && hasTrustedFullPlatformAccess(clientAccess));
  const effectiveTier = receivesFullSurface ? "store" : tier;
  const canAccessAdmin = clientAccess
    ? hasCapability(clientAccess, "platform.admin")
    : isOwner;
  const groups: Array<AccountAwareNavigationGroup | null> = [
    group("collector", "Collection", COLLECTOR_WORKSPACE_NAV, clientAccess),
  ];

  if (isAtLeast(effectiveTier, "seller")) {
    groups.push(
      group("purchasing", PURCHASING_NAV.label, PURCHASING_NAV.children, clientAccess),
      group("selling", SELLING_NAV.label, SELLING_NAV.children, clientAccess),
      group("insights", INSIGHTS_NAV.label, INSIGHTS_NAV.children, clientAccess),
      group(
        "operations",
        OPERATIONS_NAV.label,
        isAtLeast(effectiveTier, "store")
          ? OPERATIONS_NAV.children
          : OPERATIONS_NAV.children.filter((item) => item.href === LABEL_STUDIO_ROUTE),
        clientAccess,
      ),
      group("tools", "Utilities", TOOLS_NAV, clientAccess),
    );
  }

  if (isAtLeast(effectiveTier, "store")) {
    groups.push(
      group("crm", "Relationships", CRM_NAV, clientAccess),
    );
  }

  groups.push(group("settings", "Account", SECONDARY_NAV, clientAccess));
  if (canAccessAdmin) groups.push(group("admin", "Admin", ADMIN_NAV, clientAccess));

  return groups.filter((entry): entry is AccountAwareNavigationGroup => Boolean(entry));
}
