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
  Trophy,
  Truck,
  Users,
  ContactRound,
  WalletCards,
} from "lucide-react";

import { WEB_NAVIGATION_CONTRACT } from "@/lib/navigation/contract";
import { normalizeAccountTier } from "@/lib/plan-entitlements";

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
  label: "Purchasing",
  icon: PackageSearch,
  href: "/dashboard/purchasing",
  children: [
    {
      href: "/dashboard/card-photo-scanner",
      label: "Purchasing Intelligence",
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
  label: "Selling",
  icon: CircleDollarSign,
  href: "/dashboard/sell-optimizer",
  children: [
    {
      href: "/dashboard/mission-control-preview",
      label: "Mission Control Preview",
      icon: LayoutDashboard,
    },
    { href: "/dashboard/seller-launch", label: "Seller Launch", icon: Rocket },
    { href: "/dashboard/sell-optimizer", label: "Sell Optimizer", icon: CircleDollarSign },
    { href: "/dashboard/card-shows", label: "Card Shows", icon: CalendarRange },
    { href: "/dashboard/marketplaces", label: "Marketplaces", icon: Store },
    { href: "/dashboard/orders", label: "Orders", icon: ShoppingBag },
  ],
};

export const INSIGHTS_NAV: NavigationSection = {
  id: "insights",
  label: "Insights",
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
  label: "Operations",
  icon: BriefcaseBusiness,
  href: "/dashboard/tasks",
  children: [
    { href: "/dashboard/tasks", label: "Tasks", icon: ClipboardList },
    { href: "/dashboard/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/dashboard/tournaments", label: "Tournaments", icon: Trophy },
    { href: "/dashboard/vendors", label: "Vendors", icon: Truck },
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
    label: "CSV Conversion Engine",
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

function itemForContractEntry(entry: { label: string; href: string }): NavigationItem {
  return {
    href: entry.href,
    label: entry.label,
    icon: ICON_BY_LABEL[entry.label as keyof typeof ICON_BY_LABEL] ?? LayoutDashboard,
  };
}

export function getAccountAwareNavigationGroups(
  accountType: unknown,
  isOwner: boolean,
): AccountAwareNavigationGroup[] {
  const tier = normalizeAccountTier(accountType);
  const workspaceItems = WEB_NAVIGATION_CONTRACT[tier]
    .filter((item) => item.status !== "planned")
    .map(itemForContractEntry);
  const adminItems = isOwner
    ? WEB_NAVIGATION_CONTRACT.admin
        .filter((item, index, list) => {
          const firstForHref = list.findIndex((candidate) => candidate.href === item.href);
          return item.status !== "planned" && firstForHref === index;
        })
        .map(itemForContractEntry)
    : [];

  return [
    {
      id: "workspace",
      label: tier === "business" ? "Store" : "Workspace",
      items: workspaceItems,
    },
    ...(adminItems.length
      ? [{ id: "admin", label: "Admin", items: adminItems }]
      : []),
  ];
}
