"use client";

import {
  Bell,
  ChevronDown,
  Menu,
  Plus,
  Search,
  Store,
} from "lucide-react";

type TopbarProps = {
  sidebarCollapsed: boolean;
  onOpenMobileSidebar: () => void;
};

export function Topbar({
  sidebarCollapsed,
  onOpenMobileSidebar,
}: TopbarProps) {
  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-30 h-[72px] border-b border-td-ink/[0.055] bg-td-surface/82 backdrop-blur-2xl transition-[padding-left] duration-300",
        sidebarCollapsed ? "lg:pl-[88px]" : "lg:pl-[252px]",
      ].join(" ")}
    >
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobileSidebar}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-muted lg:hidden"
        >
          <Menu className="h-4.5 w-4.5" />
        </button>

        <button
          type="button"
          className="group flex h-10 min-w-0 flex-1 items-center gap-2 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-3 text-left transition hover:border-td-accent/[0.12] hover:bg-td-accent/[0.025] sm:max-w-[460px]"
        >
          <Search className="h-4 w-4 shrink-0 text-td-muted transition group-hover:text-td-accent-text/75" />
          <span className="min-w-0 flex-1 truncate text-xs text-td-muted">
            Search inventory, orders, and commands...
          </span>
          <kbd className="hidden rounded-md border border-td-ink/[0.07] bg-black/20 px-1.5 py-0.5 font-sans text-[11px] text-td-muted sm:inline-flex">
            ⌘ K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-td-accent/[0.15] bg-td-accent/[0.07] px-4 text-xs font-semibold text-td-accent-text shadow-[0_0_26px_rgb(var(--td-accent-rgb)/0.05)] transition hover:-translate-y-px hover:bg-td-accent/[0.11] sm:flex"
          >
            <Plus className="h-4 w-4 text-td-accent-text" />
            Create
          </button>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] text-td-muted transition hover:border-td-accent/[0.14] hover:bg-td-accent/[0.03] hover:text-td-accent-text"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-td-accent shadow-[0_0_8px_rgb(var(--td-accent-rgb)/0.8)]" />
          </button>

          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] px-3 text-xs text-td-secondary transition hover:border-td-accent/[0.12] hover:bg-td-accent/[0.025] md:flex"
          >
            <Store className="h-4 w-4 text-td-muted" />
            Trading Docks
            <ChevronDown className="h-3.5 w-3.5 text-td-muted" />
          </button>

          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-1.5 pr-2 text-xs text-td-secondary"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-td-accent/[0.1] font-semibold text-td-accent-text">
              JR
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-td-muted sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}

