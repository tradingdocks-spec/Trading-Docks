"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Settings,
} from "lucide-react";

import { TradingDocksMark } from "@/components/brand/trading-docks-logo";
import { dashboardNavigation } from "@/components/dashboard/navigation/navigation";

import { SidebarGroup } from "./SidebarGroup";

type SidebarProps = {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
};

const STORAGE_KEY = "trading-docks-sidebar-collapsed";

function getDefaultExpandedItems() {
  return dashboardNavigation
    .flatMap((group) => group.items)
    .filter((item) => item.children?.length)
    .slice(0, 2)
    .map((item) => item.title);
}

export function Sidebar({
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [expandedItems, setExpandedItems] = useState<string[]>(
    getDefaultExpandedItems,
  );

  useEffect(() => {
    const savedState = window.localStorage.getItem(STORAGE_KEY);

    if (savedState === "true") {
      setCollapsed(true);
    }

    if (savedState === "false") {
      setCollapsed(false);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((current) => {
      const nextValue = !current;

      window.localStorage.setItem(
        STORAGE_KEY,
        String(nextValue),
      );

      return nextValue;
    });
  }

  function toggleExpandedItem(title: string) {
    setExpandedItems((current) =>
      current.includes(title)
        ? current.filter((item) => item !== title)
        : [...current, title],
    );
  }

  const sidebarWidth = useMemo(
    () => (collapsed ? "lg:w-[84px]" : "lg:w-[280px]"),
    [collapsed],
  );

  return (
    <>
      <button
        type="button"
        aria-label="Close navigation"
        onClick={onMobileClose}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity lg:hidden ${
          mobileOpen
            ? "pointer-events-auto opacity-100"
            : "pointer-events-none opacity-0"
        }`}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col border-r border-white/[0.07] bg-[#050b10]/95 shadow-[20px_0_70px_rgba(0,0,0,0.28)] backdrop-blur-2xl transition-[transform,width] duration-300 lg:static lg:z-20 lg:translate-x-0 ${sidebarWidth} ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-cyan-400/[0.05] to-transparent"
        />

        <div className="relative flex h-16 shrink-0 items-center border-b border-white/[0.07] px-4">
          <Link
            href="/dashboard"
            onClick={onMobileClose}
            className={`flex min-w-0 items-center ${
              collapsed
                ? "w-full justify-center"
                : "gap-3"
            }`}
          >
            <div className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-cyan-300/20 bg-cyan-400/[0.08] shadow-[0_0_24px_rgba(34,211,238,0.08)]">
              <TradingDocksMark className="h-7 w-7" />
            </div>

            {!collapsed ? (
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold tracking-[-0.02em] text-white">
                  Trading Docks
                </p>

                <p className="mt-0.5 truncate text-[9px] text-slate-600">
                  Inventory workspace
                </p>
              </div>
            ) : null}
          </Link>
        </div>

        <div className="relative shrink-0 border-b border-white/[0.07] p-3">
          <button
            type="button"
            className={`group flex w-full items-center rounded-xl border border-white/[0.08] bg-white/[0.025] transition hover:border-cyan-400/20 hover:bg-cyan-400/[0.04] ${
              collapsed
                ? "h-11 justify-center px-0"
                : "min-h-14 gap-3 px-3 py-2"
            }`}
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-cyan-300/20 bg-cyan-400/[0.08] text-xs font-semibold text-cyan-200">
              TD
            </div>

            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[11px] font-semibold text-white">
                    Trading Docks LLC
                  </p>

                  <p className="mt-0.5 truncate text-[9px] text-slate-600">
                    Seller workspace
                  </p>
                </div>

                <div className="flex flex-col gap-0.5">
                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                  <span className="h-1 w-1 rounded-full bg-slate-600" />
                </div>
              </>
            ) : null}
          </button>
        </div>

        <nav className="sidebar-scrollbar relative min-h-0 flex-1 overflow-y-auto px-3 py-3">
          <div className="space-y-2">
            {dashboardNavigation.map((group, index) => (
              <SidebarGroup
                key={`${group.title ?? "main"}-${index}`}
                group={group}
                collapsed={collapsed}
                expandedItems={expandedItems}
                onToggleItem={toggleExpandedItem}
              />
            ))}
          </div>
        </nav>

        <div className="relative shrink-0 border-t border-white/[0.07] p-3">
          <div
            className={`rounded-2xl border border-white/[0.08] bg-white/[0.025] ${
              collapsed ? "p-1.5" : "p-2"
            }`}
          >
            <Link
              href="/dashboard/settings"
              onClick={onMobileClose}
              title={collapsed ? "Settings" : undefined}
              className={`group flex min-h-10 items-center rounded-xl text-slate-500 transition hover:bg-white/[0.04] hover:text-white ${
                collapsed
                  ? "justify-center"
                  : "gap-3 px-2.5"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg group-hover:text-cyan-300">
                <Settings className="h-4 w-4" />
              </span>

              {!collapsed ? (
                <span className="text-[11px] font-medium">
                  Workspace settings
                </span>
              ) : null}
            </Link>

            <button
              type="button"
              title={collapsed ? "Sign out" : undefined}
              className={`group flex min-h-10 w-full items-center rounded-xl text-slate-500 transition hover:bg-red-400/[0.05] hover:text-red-300 ${
                collapsed
                  ? "justify-center"
                  : "gap-3 px-2.5"
              }`}
            >
              <span className="flex h-8 w-8 items-center justify-center rounded-lg">
                <LogOut className="h-4 w-4" />
              </span>

              {!collapsed ? (
                <span className="text-[11px] font-medium">
                  Sign out
                </span>
              ) : null}
            </button>
          </div>

          <button
            type="button"
            onClick={toggleCollapsed}
            aria-label={
              collapsed ? "Expand sidebar" : "Collapse sidebar"
            }
            className="absolute -right-3 top-1/2 hidden h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/10 bg-[#0a131a] text-slate-500 shadow-lg transition hover:border-cyan-400/30 hover:text-cyan-300 lg:flex"
          >
            {collapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronsLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </aside>

      <style jsx global>{`
        .sidebar-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(148, 163, 184, 0.14)
            transparent;
        }

        .sidebar-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .sidebar-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }

        .sidebar-scrollbar::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.12);
        }

        .sidebar-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(34, 211, 238, 0.2);
        }
      `}</style>
    </>
  );
}