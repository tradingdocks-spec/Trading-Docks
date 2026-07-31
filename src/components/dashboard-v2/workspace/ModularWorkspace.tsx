"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  FileUp,
  Layers3,
  LibraryBig,
  MoreHorizontal,
  PackagePlus,
  Settings2,
  ShoppingBag,
  Sparkles,
  Store,
  TrendingUp,
} from "lucide-react";

import { WorkspaceFrame } from "../common/WorkspaceFrame";
import styles from "../styles.module.css";

const SETUP_ITEMS = [
  {
    title: "Add your first cards",
    description: "Add cards manually or scan your collection.",
    href: "/dashboard/inventory",
    action: "Add cards",
    icon: PackagePlus,
  },
  {
    title: "Import or build a deck",
    description: "Bring in a list or start a deck from scratch.",
    href: "/dashboard/deck-vault",
    action: "Open Deck Vault",
    icon: LibraryBig,
  },
  {
    title: "Connect a marketplace",
    description: "Keep orders and listings in one workspace.",
    href: "/dashboard/marketplaces",
    action: "View connections",
    icon: Store,
  },
] as const;

const METRICS = [
  {
    label: "Collection value",
    value: "$0.00",
    detail: "Add cards to calculate",
    href: "/dashboard/inventory",
    icon: CircleDollarSign,
  },
  {
    label: "Total cards",
    value: "0",
    detail: "Across 0 locations",
    href: "/dashboard/inventory",
    icon: Boxes,
  },
  {
    label: "Decks",
    value: "0",
    detail: "Create your first deck",
    href: "/dashboard/deck-vault",
    icon: Layers3,
  },
  {
    label: "Sales this month",
    value: "$0.00",
    detail: "No marketplace connected",
    href: "/dashboard/marketplaces",
    icon: ShoppingBag,
  },
] as const;

export function ModularWorkspace() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(window.navigator.platform));
  }, []);

  return (
    <WorkspaceFrame>
      <section className="relative">
        <header className="flex flex-col gap-5 border-b border-white/[0.06] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-medium text-cyan-300">
              <Sparkles className="h-3.5 w-3.5" />
              Your workspace is ready
            </div>
            <h1 className="text-3xl font-semibold tracking-[-0.045em] text-white sm:text-[2.5rem]">
              Good afternoon, Jeremy.
            </h1>
            <p className="mt-2.5 text-sm text-slate-400 sm:text-[15px]">
              Let’s get your collection set up and working for you.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/inventory"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-cyan-300 px-4 text-xs font-semibold text-[#001018] shadow-[0_10px_28px_rgba(34,211,238,0.16)] transition hover:-translate-y-0.5 hover:bg-cyan-200"
            >
              <PackagePlus className="h-4 w-4" />
              Add cards
            </Link>
            <Link
              href="/dashboard/collection-buying"
              className="hidden h-11 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.025] px-4 text-xs font-semibold text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.045] sm:inline-flex"
            >
              <FileUp className="h-4 w-4" />
              Import
            </Link>
            <div className="relative">
              <button
                type="button"
                aria-label="Dashboard options"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen((value) => !value)}
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.025] text-slate-400 transition hover:text-white"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen ? (
                <div className="absolute right-0 top-12 z-30 w-52 rounded-xl border border-white/[0.09] bg-[#07141e]/98 p-1.5 shadow-2xl backdrop-blur-xl">
                  <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-xs text-slate-300 hover:bg-white/[0.05]">
                    <Settings2 className="h-3.5 w-3.5" /> Customize dashboard
                  </button>
                  <p className="px-3 pb-2 pt-1 text-[10px] leading-4 text-slate-600">
                    More layouts unlock as your workspace grows.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {METRICS.map((metric) => {
            const Icon = metric.icon;
            return (
              <Link
                key={metric.label}
                href={metric.href}
                className={`${styles.glassPanel} group rounded-[20px] p-4 transition duration-200 hover:-translate-y-0.5`}
              >
                <div className="flex items-start justify-between">
                  <p className="text-xs font-medium text-slate-400">{metric.label}</p>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.035] text-slate-500 transition group-hover:bg-cyan-400/[0.07] group-hover:text-cyan-300">
                    <Icon className="h-4 w-4" />
                  </span>
                </div>
                <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-white">
                  {metric.value}
                </p>
                <p className="mt-1.5 flex items-center gap-1 text-[11px] text-slate-500 transition group-hover:text-slate-300">
                  {metric.detail}
                  <ArrowRight className="h-3 w-3 opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </p>
              </Link>
            );
          })}
        </div>

        <section className={`${styles.glassPanel} mt-4 overflow-hidden rounded-[24px]`}>
          <div className="flex flex-col gap-4 border-b border-white/[0.06] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-300">
                Getting started
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">
                Set up your Trading Docks workspace
              </h2>
              <p className="mt-1.5 text-xs leading-5 text-slate-400">
                Three quick steps unlock collection insights, deck tools, and sales tracking.
              </p>
            </div>
            <div className="min-w-[150px]">
              <div className="flex items-center justify-between text-[10px] font-medium text-slate-500">
                <span>0 of 3 complete</span>
                <span>0%</span>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                <div className="h-full w-0 rounded-full bg-cyan-300" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 divide-y divide-white/[0.055] lg:grid-cols-3 lg:divide-x lg:divide-y-0">
            {SETUP_ITEMS.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  className="group flex min-h-[160px] flex-col p-5 transition hover:bg-white/[0.02] sm:p-6"
                >
                  <div className="flex items-start justify-between">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-300/[0.1] bg-cyan-400/[0.045] text-cyan-300">
                      <Icon className="h-4.5 w-4.5" />
                    </span>
                    <span className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.08] text-[10px] font-semibold text-slate-600 group-hover:border-cyan-300/20 group-hover:text-cyan-300">
                      {index + 1}
                    </span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold text-white">{item.title}</h3>
                  <p className="mt-1.5 text-[11px] leading-5 text-slate-500">{item.description}</p>
                  <span className="mt-auto flex items-center gap-1.5 pt-4 text-[11px] font-semibold text-cyan-300">
                    {item.action}
                    <ArrowRight className="h-3 w-3 transition group-hover:translate-x-1" />
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.55fr_0.85fr]">
          <section className={`${styles.glassPanel} rounded-[22px] p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Collection activity</h2>
                <p className="mt-1 text-[11px] text-slate-500">Your collection history will appear here.</p>
              </div>
              <TrendingUp className="h-4 w-4 text-slate-600" />
            </div>
            <div className="mt-5 flex min-h-[180px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/[0.08] bg-black/[0.08] px-6 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cyan-400/[0.05] text-cyan-300">
                <Boxes className="h-5 w-5" />
              </span>
              <p className="mt-3 text-sm font-semibold text-slate-200">No collection activity yet</p>
              <p className="mt-1 max-w-sm text-[11px] leading-5 text-slate-500">
                Add your first cards to see value changes and collection trends.
              </p>
              <Link href="/dashboard/inventory" className="mt-4 text-[11px] font-semibold text-cyan-300 hover:text-cyan-200">
                Add cards now →
              </Link>
            </div>
          </section>

          <section className={`${styles.glassPanel} rounded-[22px] p-5 sm:p-6`}>
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-white">Upcoming</h2>
                <p className="mt-1 text-[11px] text-slate-500">Events and important tasks.</p>
              </div>
              <CalendarDays className="h-4 w-4 text-slate-600" />
            </div>
            <div className="mt-5 flex min-h-[180px] flex-col items-center justify-center text-center">
              <Clock3 className="h-6 w-6 text-slate-700" />
              <p className="mt-3 text-sm font-medium text-slate-300">Your schedule is clear</p>
              <p className="mt-1 text-[11px] leading-5 text-slate-500">Add events when you are ready.</p>
              <Link href="/dashboard/calendar" className="mt-4 inline-flex h-9 items-center rounded-lg border border-white/[0.08] px-3 text-[11px] font-semibold text-slate-300 hover:bg-white/[0.04]">
                Open calendar
              </Link>
            </div>
          </section>
        </div>

        <p className="mt-5 text-center text-[10px] text-slate-700">
          Tip: press {isMac ? "⌘ K" : "Ctrl K"} to search anywhere in Trading Docks.
        </p>
      </section>
    </WorkspaceFrame>
  );
}
