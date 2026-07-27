"use client";

import {
  Bell,
  ChevronDown,
  Menu,
  Plus,
  Store,
} from "lucide-react";

import { GlobalSearch } from "../search/GlobalSearch";

export function Topbar({
  collapsed,
  onOpenMobile,
}: {
  collapsed: boolean;
  onOpenMobile: () => void;
}) {
  return (
    <header
      className={[
        "fixed inset-x-0 top-0 z-30 h-[72px] border-b border-white/[0.055] bg-[#041019]/84 backdrop-blur-2xl transition-[padding-left] duration-300",
        collapsed ? "lg:pl-[88px]" : "lg:pl-[258px]",
      ].join(" ")}
    >
      <div className="flex h-full items-center gap-3 px-4 sm:px-6">
        <button
          type="button"
          onClick={onOpenMobile}
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>

        <GlobalSearch />

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-cyan-300/[0.15] bg-cyan-400/[0.07] px-4 text-xs font-semibold text-cyan-100 transition hover:-translate-y-px hover:bg-cyan-400/[0.11] sm:flex"
          >
            <Plus className="h-4 w-4 text-cyan-300" />
            Create
          </button>

          <button
            type="button"
            className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.025] text-slate-500"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_8px_rgba(103,232,249,0.8)]" />
          </button>

          <button
            type="button"
            className="hidden h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] px-3 text-xs text-slate-400 md:flex"
          >
            <Store className="h-4 w-4 text-slate-600" />
            Trading Docks
            <ChevronDown className="h-3.5 w-3.5 text-slate-700" />
          </button>

          <button
            type="button"
            className="flex h-10 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 pr-2 text-xs text-slate-400"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/[0.1] font-semibold text-cyan-200">
              JR
            </span>
            <ChevronDown className="hidden h-3.5 w-3.5 text-slate-700 sm:block" />
          </button>
        </div>
      </div>
    </header>
  );
}
