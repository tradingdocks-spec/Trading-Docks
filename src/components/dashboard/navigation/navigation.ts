import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  BellRing,
  Boxes,
  Building2,
  CreditCard,
  FolderKanban,
  Gauge,
  Layers3,
  ListChecks,
  Package,
  ReceiptText,
  Settings,
  ShoppingBag,
  Sparkles,
  Store,
  Tags,
  Truck,
  Users,
  Warehouse,
  WandSparkles,
} from "lucide-react";

export type NavigationChild = {
  title: string;
  href: string;
  badge?: string;
};

export type NavigationItem = {
  title: string;
  href?: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavigationChild[];
};

export type NavigationGroup = {
  title?: string;
  items: NavigationItem[];
};

export const dashboardNavigation: NavigationGroup[] = [
  {
    items: [
      {
        title: "Dashboard",
        href: "/dashboard",
        icon: Gauge,
      },
    ],
  },
  {
    title: "Inventory",
    items: [
      {
        title: "Inventory",
        icon: Boxes,
        children: [
          {
            title: "Overview",
            href: "/dashboard/inventory",
          },
          {
            title: "Singles",
            href: "/dashboard/inventory?view=singles",
          },
          {
            title: "Sealed Products",
            href: "/dashboard/inventory?view=sealed",
          },
          {
            title: "Graded Cards",
            href: "/dashboard/inventory?view=graded",
          },
          {
            title: "Bulk Inventory",
            href: "/dashboard/inventory?view=bulk",
          },
          {
            title: "Chaos Sort",
            href: "/dashboard/inventory/chaos-sort",
          },
          {
            title: "Supplies",
            href: "/dashboard/inventory?view=supplies",
          },
        ],
      },
      {
        title: "Organization",
        icon: FolderKanban,
        children: [
          {
            title: "Binders",
            href: "/dashboard/organization/binders",
          },
          {
            title: "Set Collections",
            href: "/dashboard/organization/sets",
          },
          {
            title: "Decks",
            href: "/dashboard/organization/decks",
          },
          {
            title: "Storage Locations",
            href: "/dashboard/organization/locations",
          },
          {
            title: "Tags",
            href: "/dashboard/organization/tags",
          },
        ],
      },
      {
        title: "Imports",
        icon: Layers3,
        children: [
          {
            title: "CSV Import",
            href: "/dashboard/imports/csv",
          },
          {
            title: "Bulk Intake",
            href: "/dashboard/imports/bulk",
          },
          {
            title: "Set Sort",
            href: "/dashboard/imports/set-sort",
          },
        ],
      },
    ],
  },
  {
    title: "Commerce",
    items: [
      {
        title: "Marketplaces",
        icon: Store,
        children: [
          {
            title: "Overview",
            href: "/dashboard/marketplaces",
          },
          {
            title: "TCGplayer",
            href: "/dashboard/marketplaces/tcgplayer",
          },
          {
            title: "eBay",
            href: "/dashboard/marketplaces/ebay",
          },
          {
            title: "Shopify",
            href: "/dashboard/marketplaces/shopify",
          },
          {
            title: "Mana Pool",
            href: "/dashboard/marketplaces/mana-pool",
          },
          {
            title: "CardSphere",
            href: "/dashboard/marketplaces?channel=cardsphere",
          },
          {
            title: "CardTrader",
            href: "/dashboard/marketplaces?channel=cardtrader",
          },
          {
            title: "Misprint (Pokémon)",
            href: "/dashboard/marketplaces?channel=misprint",
          },
        ],
      },
      {
        title: "Listings",
        href: "/dashboard/listings",
        icon: ShoppingBag,
      },
      {
        title: "Orders",
        href: "/dashboard/orders",
        icon: Package,
        badge: "12",
      },
      {
        title: "Shipping",
        href: "/dashboard/shipping",
        icon: Truck,
      },
    ],
  },
  {
    title: "Business",
    items: [
      {
        title: "Finances",
        icon: CreditCard,
        children: [
          {
            title: "Overview",
            href: "/dashboard/finances",
          },
          {
            title: "Sales",
            href: "/dashboard/finances/sales",
          },
          {
            title: "Purchases",
            href: "/dashboard/finances/purchases",
          },
          {
            title: "Expenses",
            href: "/dashboard/finances/expenses",
          },
          {
            title: "Payouts",
            href: "/dashboard/finances/payouts",
          },
        ],
      },
      {
        title: "Analytics",
        href: "/dashboard/analytics",
        icon: BarChart3,
      },
      {
        title: "Reports",
        href: "/dashboard/reports",
        icon: ReceiptText,
      },
      {
        title: "Tasks",
        href: "/dashboard/tasks",
        icon: ListChecks,
      },
    ],
  },
  {
    title: "Operations",
    items: [
      {
        title: "Automation",
        href: "/dashboard/automation",
        icon: WandSparkles,
      },
      {
        title: "Price Alerts",
        href: "/dashboard/price-alerts",
        icon: BellRing,
      },
      {
        title: "Team",
        href: "/dashboard/team",
        icon: Users,
      },
      {
        title: "Warehouse",
        href: "/dashboard/warehouse",
        icon: Warehouse,
      },
      {
        title: "Workspaces",
        href: "/dashboard/workspaces",
        icon: Building2,
      },
    ],
  },
  {
    title: "System",
    items: [
      {
        title: "AI Tools",
        href: "/dashboard/ai-tools",
        icon: Sparkles,
        badge: "Beta",
      },
      {
        title: "Tags & Fields",
        href: "/dashboard/settings/fields",
        icon: Tags,
      },
      {
        title: "Settings",
        href: "/dashboard/settings",
        icon: Settings,
      },
    ],
  },
];

export const quickCreateItems = [
  {
    title: "Add Card",
    href: "/dashboard/inventory/new?type=single",
    icon: Layers3,
  },
  {
    title: "Add Sealed Product",
    href: "/dashboard/inventory/new?type=sealed",
    icon: Package,
  },
  {
    title: "Add Graded Card",
    href: "/dashboard/inventory/new?type=graded",
    icon: Sparkles,
  },
  {
    title: "Create Binder",
    href: "/dashboard/organization/binders/new",
    icon: FolderKanban,
  },
  {
    title: "Create Listing",
    href: "/dashboard/listings/new",
    icon: ShoppingBag,
  },
  {
    title: "Record Purchase",
    href: "/dashboard/finances/purchases/new",
    icon: CreditCard,
  },
  {
    title: "Record Expense",
    href: "/dashboard/finances/expenses/new",
    icon: ReceiptText,
  },
  {
    title: "Create Task",
    href: "/dashboard/tasks/new",
    icon: ListChecks,
  },
] satisfies Array<{
  title: string;
  href: string;
  icon: LucideIcon;
}>;
