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
        "fixed inset-x-0 top-0 z-30 h-16 border-b border-white/[0.055] bg-[#061018]/80 backdrop-blur-2xl transition-[padding] duration-300",
        sidebarCollapsed
          ? "lg:pl-[76px]"
          : "lg:pl-[244px]",
      ].join(" ")}
    >
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          aria-label="Open navigation"
          onClick={onOpenMobileSidebar}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03] text-slate-500 transition hover:bg-white/[0.06] hover:text-white lg:hidden"
        >
          <Menu className="h-[18px] w-[18px]" />
        </button>

        <button
          type="button"
          className="group flex h-9 min-w-0 flex-1 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-left transition hover:border-white/[0.11] hover:bg-white/[0.045] sm:max-w-[430px]"
        >
          <Search className="h-4 w-4 shrink-0 text-slate-600 transition group-hover:text-slate-400" />

          <span className="min-w-0 flex-1 truncate text-xs text-slate-600">
            Search inventory, orders, and commands...
          </span>

          <kbd className="hidden rounded-md border border-white/[0.07] bg-black/20 px-1.5 py-0.5 font-sans text-[10px] text-slate-600 sm:inline-flex">
            ⌘ K
          </kbd>
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="hidden h-9 items-center gap-2 rounded-xl border border-cyan-300/[0.12] bg-cyan-400/[0.07] px-3 text-xs font-medium text-cyan-100 shadow-[0_0_24px_rgba(34,211,238,0.045)] transition hover:-translate-y-px hover:border-cyan-300/20 hover:bg-cyan-400/[0.11] sm:flex"
          >
            <Plus className="h-4 w-4 text-cyan-300" />
            Create
          </button>

          <button
            type="button"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500 transition hover:border-white/[0.11] hover:bg-white/[0.055] hover:text-slate-200"
            aria-label="Notifications"
          >
            <Bell className="h-[17px] w-[17px]" />

            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
          </button>

          <button
            type="button"
            className="hidden h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-slate-400 transition hover:border-white/[0.11] hover:bg-white/[0.055] hover:text-slate-200 md:flex"
          >
            <Store className="h-4 w-4 text-slate-600" />

            <span>Trading Docks</span>

            <ChevronDown className="h-3.5 w-3.5 text-slate-700" />
          </button>

          <button
            type="button"
            className="flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1 pr-1.5 transition hover:border-white/[0.11] hover:bg-white/[0.055]"
            aria-label="Open profile menu"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300/20 to-blue-500/10 text-[10px] font-semibold text-cyan-200">
              JR
            </span>

            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-700 sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}