import {
  BarChart3,
  Bot,
  Boxes,
  BrainCircuit,
  CalendarDays,
  CircleDollarSign,
  DatabaseZap,
  ClipboardList,
  FileBarChart2,
  Gem,
  History,
  LayoutDashboard,
  LibraryBig,
  PackageCheck,
  PackageOpen,
  PackageSearch,
  Percent,
  Scale,
  ScanLine,
  Settings,
  ShoppingBag,
  Store,
  Trophy,
  Truck,
  Users,
  WalletCards,
} from "lucide-react";

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
    href: "/dashboard/deck-vault",
    label: "Deck Vault",
    icon: LibraryBig,
  },
];

export const PURCHASING_NAV: NavigationSection = {
  id: "purchasing",
  label: "Purchasing",
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
      label: "Image Lookup",
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
    icon: CalendarDays,
  },
  {
    href: "/dashboard/marketplaces",
    label: "Marketplaces",
    icon: Store,
  },
  {
    href: "/dashboard/orders",
    label: "Orders",
    icon: ShoppingBag,
  },
];

export const BUSINESS_NAV: NavigationItem[] = [
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
