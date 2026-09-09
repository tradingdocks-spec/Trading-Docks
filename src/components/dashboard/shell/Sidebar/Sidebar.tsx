"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Bot,
  Boxes,
  ChevronLeft,
  CircleDollarSign,
  LayoutDashboard,
  Settings,
  ShoppingBag,
  Store,
  Tags,
  X,
} from "lucide-react";

type SidebarProps = {
  collapsed: boolean;
  mobileOpen: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
};

const groups = [
  {
    label: null,
    items: [
      ["/dashboard", "Dashboard", LayoutDashboard],
      ["/dashboard/inventory", "Inventory", Boxes],
      ["/dashboard/organization", "Organization", Tags],
      ["/dashboard/marketplaces", "Marketplaces", Store],
      ["/dashboard/orders", "Orders", ShoppingBag],
    ],
  },
  {
    label: "Operations",
    items: [
      ["/dashboard/finances", "Finances", CircleDollarSign],
      ["/dashboard/analytics", "Analytics", BarChart3],
      ["/dashboard/automation", "Automation", Bot],
    ],
  },
] as const;

export function Sidebar({
  collapsed,
  mobileOpen,
  onToggleCollapsed,
  onCloseMobile,
}: SidebarProps) {
  const pathname = usePathname();

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
          "fixed inset-y-0 left-0 z-50 flex flex-col overflow-hidden border-r border-td-ink/[0.055] bg-td-canvas/96 shadow-[22px_0_70px_rgb(var(--td-shadow-rgb)/calc(0.22*var(--td-shadow-strength)))] backdrop-blur-2xl transition-all duration-300",
          collapsed ? "w-[88px]" : "w-[252px]",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-24 -top-20 h-72 w-72 rounded-full bg-td-accent/[0.055] blur-[110px]" />
          <div className="absolute inset-y-0 right-0 w-px bg-gradient-to-b from-transparent via-td-accent/[0.13] to-transparent" />
        </div>

        <div className="relative flex h-[72px] items-center border-b border-td-ink/[0.055] px-3">
          <Link
            href="/dashboard"
            onClick={onCloseMobile}
            className="group flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 transition hover:bg-td-ink/[0.025]"
          >
            <span className="relative flex h-12 w-12 shrink-0 items-center justify-center">
              <span className="absolute inset-1 rounded-2xl bg-td-accent/[0.12] blur-xl transition group-hover:bg-td-accent/[0.2]" />
              <Image
                src="/trading-docks-mark.png"
                alt=""
                width={96}
                height={96}
                priority
                sizes="48px"
                className="relative h-12 w-12 object-contain transition duration-500 group-hover:-translate-y-0.5 group-hover:scale-105"
              />
            </span>

            {!collapsed ? (
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold tracking-[-0.025em] text-td-primary">
                  Trading Docks
                </span>
                <span className="mt-0.5 block text-[11px] uppercase tracking-[0.24em] text-td-muted">
                  Collectibles OS
                </span>
              </span>
            ) : null}
          </Link>

          <button
            type="button"
            onClick={onCloseMobile}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-muted lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="relative flex-1 overflow-y-auto px-3 py-5">
          {groups.map((group, groupIndex) => (
            <div key={group.label ?? "main"}>
              {group.label && !collapsed ? (
                <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-td-muted">
                  {group.label}
                </p>
              ) : null}

              <div className="space-y-1.5">
                {group.items.map(([href, label, Icon]) => {
                  const active =
                    href === "/dashboard"
                      ? pathname === href
                      : pathname.startsWith(href);

                  return (
                    <Link
                      key={href}
                      href={href}
                      onClick={onCloseMobile}
                      title={collapsed ? label : undefined}
                      className={[
                        "group relative flex h-11 items-center overflow-hidden rounded-xl border transition duration-300",
                        collapsed ? "justify-center px-0" : "gap-3 px-3",
                        active
                          ? "border-td-accent/[0.2] bg-td-accent/[0.07] text-td-primary shadow-[0_0_28px_rgb(var(--td-accent-rgb)/0.055),inset_0_1px_rgb(var(--td-ink-rgb)/0.025)]"
                          : "border-transparent text-td-muted hover:border-td-ink/[0.065] hover:bg-td-ink/[0.025] hover:text-td-primary",
                      ].join(" ")}
                    >
                      {active ? (
                        <>
                          <span className="absolute inset-y-2 left-0 w-[2px] rounded-r-full bg-td-accent shadow-[0_0_10px_rgb(var(--td-accent-rgb)/0.8)]" />
                          <span className="absolute left-0 top-1/2 h-8 w-20 -translate-y-1/2 rounded-full bg-td-accent/[0.08] blur-xl" />
                        </>
                      ) : null}

                      <Icon
                        className={[
                          "relative z-10 h-4 w-4 shrink-0 transition",
                          active
                            ? "text-td-accent-text"
                            : "text-td-muted group-hover:text-td-accent-text/80",
                        ].join(" ")}
                      />

                      {!collapsed ? (
                        <span className="relative z-10 text-sm font-medium">
                          {label}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>

              {groupIndex === 0 ? (
                <div className="my-5 h-px bg-gradient-to-r from-transparent via-white/[0.075] to-transparent" />
              ) : null}
            </div>
          ))}
        </nav>

        <div className="relative border-t border-td-ink/[0.055] p-3">
          <Link
            href="/dashboard/settings"
            className={[
              "flex h-11 items-center rounded-xl border border-transparent text-td-muted transition hover:border-td-ink/[0.06] hover:bg-td-ink/[0.025] hover:text-td-primary",
              collapsed ? "justify-center" : "gap-3 px-3",
            ].join(" ")}
          >
            <Settings className="h-4 w-4 text-td-muted" />
            {!collapsed ? <span className="text-sm font-medium">Settings</span> : null}
          </Link>

          <div
            className={[
              "mt-3 flex items-center rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.018] p-2.5",
              collapsed ? "justify-center" : "gap-3",
            ].join(" ")}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-td-accent/20 bg-td-accent/[0.08] text-xs font-semibold text-td-accent-text shadow-[0_0_20px_rgb(var(--td-accent-rgb)/0.09)]">
              JR
            </div>

            {!collapsed ? (
              <>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-td-primary">Jeremy</p>
                  <p className="mt-0.5 text-[11px] text-td-muted">Seller workspace</p>
                </div>

                <button
                  type="button"
                  aria-label="Collapse sidebar"
                  onClick={onToggleCollapsed}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-td-ink/[0.06] bg-td-ink/[0.018] text-td-muted transition hover:border-td-accent/20 hover:text-td-accent-text"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </>
            ) : (
              <button
                type="button"
                aria-label="Expand sidebar"
                onClick={onToggleCollapsed}
                className="absolute inset-0"
              />
            )}
          </div>
        </div>
      </aside>
    </>
  );
}
