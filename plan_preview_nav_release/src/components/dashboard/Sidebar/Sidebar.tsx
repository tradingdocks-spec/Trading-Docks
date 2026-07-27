"use client";

import {
  BarChart3,
  Bot,
  Boxes,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  LayoutDashboard,
  PackageSearch,
  ReceiptText,
  Settings,
  ShoppingBag,
  Tags,
  X,
} from "lucide-react";

import { SidebarItem } from "./SidebarItem";
import { SidebarLogo } from "./SidebarLogo";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

const primaryNavigation = [
  {
    label: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
    exact: true,
  },
  {
    label: "Inventory",
    href: "/dashboard/inventory",
    icon: Boxes,
  },
  {
    label: "Organization",
    href: "/dashboard/organization",
    icon: Tags,
  },
  {
    label: "Marketplaces",
    href: "/dashboard/marketplaces",
    icon: ShoppingBag,
  },
  {
    label: "Orders",
    href: "/dashboard/orders",
    icon: PackageSearch,
  },
];

const businessNavigation = [
  {
    label: "Finances",
    href: "/dashboard/finances",
    icon: CreditCard,
  },
  {
    label: "Analytics",
    href: "/dashboard/analytics",
    icon: BarChart3,
  },
  {
    label: "Automation",
    href: "/dashboard/automation",
    icon: Bot,
  },
];

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  return (
    <>
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/65 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 flex flex-col border-r border-white/[0.06] bg-[#071017]/95 shadow-[24px_0_70px_rgba(0,0,0,0.24)] backdrop-blur-2xl transition-[width,transform] duration-300 ease-out",
          collapsed ? "lg:w-[76px]" : "lg:w-[244px]",
          "w-[264px]",
          mobileOpen
            ? "translate-x-0"
            : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="relative">
          <SidebarLogo collapsed={collapsed} />

          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onCloseMobile}
            className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.03] text-slate-500 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4">
          <div className="space-y-1">
            {primaryNavigation.map((item) => (
              <SidebarItem
                key={item.href}
                {...item}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
              />
            ))}
          </div>

          <div className="my-5 border-t border-white/[0.05]" />

          {!collapsed ? (
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-700">
              Operations
            </p>
          ) : null}

          <div className="space-y-1">
            {businessNavigation.map((item) => (
              <SidebarItem
                key={item.href}
                {...item}
                collapsed={collapsed}
                onNavigate={onCloseMobile}
              />
            ))}
          </div>
        </nav>

        <div className="border-t border-white/[0.06] p-3">
          <SidebarItem
            href="/dashboard/settings"
            label="Settings"
            icon={Settings}
            collapsed={collapsed}
            onNavigate={onCloseMobile}
          />

          <div
            className={[
              "mt-3 flex items-center",
              collapsed
                ? "justify-center"
                : "justify-between px-1",
            ].join(" ")}
          >
            {!collapsed ? (
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.07] bg-white/[0.04]">
                  <ReceiptText className="h-4 w-4 text-slate-500" />
                </div>

                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-slate-400">
                    Trading Docks
                  </p>

                  <p className="truncate text-[10px] text-slate-700">
                    Seller Workspace
                  </p>
                </div>
              </div>
            ) : null}

            <button
              type="button"
              onClick={onToggleCollapsed}
              title="Toggle sidebar (Ctrl+B)"
              aria-label={
                collapsed
                  ? "Expand sidebar"
                  : "Collapse sidebar"
              }
              className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.06] bg-white/[0.025] text-slate-600 transition hover:border-white/[0.1] hover:bg-white/[0.06] hover:text-slate-200 lg:flex"
            >
              {collapsed ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <ChevronLeft className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}