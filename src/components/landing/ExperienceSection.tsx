"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Boxes,
  Building2,
  Check,
  CircleDollarSign,
  PackageCheck,
  PackageSearch,
  RefreshCw,
  Search,
  ShoppingBag,
  Sparkles,
  Store,
  Users,
} from "lucide-react";

import { TransitionLink } from "@/components/navigation/PolishedNavigation";

const personas = {
  collector: {
    label: "I’m a collector",
    plan: "Collector",
    tagline: "Understand the value and shape of your collection.",
    metricLabels: ["Collection value", "Inventory", "Saved decks", "30-day growth"],
    metricValues: ["$48,260", "3,842", "27", "+4.8%"],
    nav: ["Dashboard", "Inventory", "Deck Vault", "Analytics", "CSV Engine"],
    activity: [
      ["Binder value updated", "+$184"],
      ["Collection imported", "126 cards"],
      ["Deck price refreshed", "$428.19"],
    ],
    accent: "from-cyan-300 to-blue-500",
    icon: BarChart3,
  },
  seller: {
    label: "I sell online",
    plan: "Seller",
    tagline: "Turn purchasing, listings, and orders into one workflow.",
    metricLabels: ["Inventory value", "Active listings", "Open orders", "Monthly profit"],
    metricValues: ["$284,860", "22,640", "84", "$6,842"],
    nav: ["Purchasing", "Customer CRM", "Marketplaces", "Orders", "Automation"],
    activity: [
      ["Mana Pool synced", "148 orders"],
      ["TCGplayer listing sold", "$42.18"],
      ["Buylist opportunity", "+31% margin"],
    ],
    accent: "from-blue-400 to-cyan-300",
    icon: PackageSearch,
  },
  store: {
    label: "I own a store",
    plan: "Store",
    tagline: "Operate staff, vendors, events, and finances from one system.",
    metricLabels: ["Store revenue", "Inventory units", "Team members", "Open tasks"],
    metricValues: ["$128,420", "84,216", "5", "18"],
    nav: ["Business Intelligence", "Tasks", "Tournaments", "Vendors", "Employees"],
    activity: [
      ["Tournament check-in", "42 players"],
      ["Supply order received", "8 cartons"],
      ["Payroll approved", "5 employees"],
    ],
    accent: "from-cyan-300 via-blue-400 to-indigo-500",
    icon: Building2,
  },
} as const;

type PersonaKey = keyof typeof personas;

const chartShapes: Record<PersonaKey, number[]> = {
  collector: [26, 34, 31, 43, 47, 55, 52, 64, 67, 74, 79, 88],
  seller: [32, 45, 39, 56, 49, 69, 61, 77, 71, 88, 82, 96],
  store: [41, 39, 51, 58, 54, 66, 71, 69, 82, 86, 91, 100],
};

export function ExperienceSection() {
  const [active, setActive] = useState<PersonaKey>("seller");
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const persona = personas[active];
  const Icon = persona.icon;

  useEffect(() => {
    setSynced(false);
    setSyncing(false);
  }, [active]);

  const statusText = useMemo(() => {
    if (syncing) return "Syncing workspace…";
    if (synced) return "Workspace updated just now";
    return "Live product simulation";
  }, [syncing, synced]);

  function runSync() {
    if (syncing) return;
    setSyncing(true);
    window.setTimeout(() => {
      setSyncing(false);
      setSynced(true);
    }, 1150);
  }

  return (
    <section id="experience" data-td-reveal className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#020912] px-5 py-24 sm:px-8 lg:px-12 lg:py-32">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[12%] top-[-12rem] h-[30rem] w-[30rem] rounded-full bg-blue-500/[0.1] blur-[140px]" />
        <div className="absolute bottom-[-12rem] right-[8%] h-[28rem] w-[28rem] rounded-full bg-cyan-300/[0.07] blur-[130px]" />
      </div>

      <div className="relative mx-auto max-w-[1480px]">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.16] bg-cyan-300/[0.05] px-3.5 py-2 text-xs font-semibold text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Build your workspace
            </div>
            <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              See Trading Docks built around you.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-500">
              Choose how you use cards and watch the workspace, navigation, metrics, and recommended plan change instantly.
            </p>
          </div>

          <div className="grid gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-2 sm:grid-cols-3">
            {(Object.keys(personas) as PersonaKey[]).map((key) => {
              const item = personas[key];
              const ItemIcon = item.icon;
              const selected = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActive(key)}
                  className={[
                    "group flex min-h-14 items-center gap-3 rounded-xl px-4 text-left transition duration-300",
                    selected
                      ? "bg-gradient-to-r from-blue-500/[0.2] to-cyan-300/[0.08] text-white shadow-[inset_0_0_0_1px_rgba(103,232,249,.15)]"
                      : "text-slate-500 hover:bg-white/[0.035] hover:text-white",
                  ].join(" ")}
                >
                  <ItemIcon className={selected ? "h-4 w-4 text-cyan-200" : "h-4 w-4 text-blue-300/55"} />
                  <span className="text-sm font-semibold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-10 grid overflow-hidden rounded-[32px] border border-blue-300/[0.15] bg-[#06131e] shadow-[0_36px_120px_rgba(0,0,0,.5)] lg:grid-cols-[250px_1fr]">
          <aside className="border-b border-white/[0.06] bg-[#030d16] p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3 rounded-2xl border border-blue-300/[0.1] bg-blue-400/[0.04] p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/[0.08] text-cyan-200">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{persona.plan} workspace</p>
                <p className="mt-0.5 text-xs text-slate-600">Recommended for you</p>
              </div>
            </div>

            <div className="mt-5 space-y-1">
              {persona.nav.map((item, index) => (
                <div
                  key={item}
                  className={[
                    "flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition",
                    index === 0
                      ? "bg-gradient-to-r from-blue-500/[0.17] to-transparent text-white"
                      : "text-slate-500",
                  ].join(" ")}
                >
                  <span className={index === 0 ? "h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.8)]" : "h-1.5 w-1.5 rounded-full bg-slate-800"} />
                  {item}
                </div>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-white/[0.06] bg-white/[0.018] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-700">Your plan</p>
              <p className="mt-2 text-lg font-semibold text-white">{persona.plan}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{persona.tagline}</p>
            </div>
          </aside>

          <div className="min-w-0 p-4 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">Interactive product preview</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">{persona.plan} overview</h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-black/[0.12] px-3 py-2 text-xs text-slate-500 sm:flex">
                  <Search className="h-3.5 w-3.5" />
                  Search your workspace
                </span>
                <button
                  type="button"
                  onClick={runSync}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300/[0.16] bg-cyan-300/[0.06] px-3.5 text-xs font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-300/[0.1]"
                >
                  <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  {syncing ? "Syncing" : "Run live sync"}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {persona.metricLabels.map((label, index) => {
                const MetricIcon = [CircleDollarSign, Boxes, PackageCheck, ShoppingBag][index];
                return (
                  <div key={label} className="td-spotlight-card rounded-2xl border border-white/[0.07] bg-[#081925] p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</p>
                      <MetricIcon className="h-4 w-4 text-blue-300/70" />
                    </div>
                    <p className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white">{persona.metricValues[index]}</p>
                    <p className="mt-1 text-xs text-emerald-300">{index % 2 === 0 ? "+8.4% this month" : "Updated moments ago"}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1.45fr_.75fr]">
              <div className="rounded-2xl border border-white/[0.07] bg-[#030c14] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Workspace momentum</p>
                    <p className="mt-1 text-xs text-slate-600">Live simulation based on your selected account type</p>
                  </div>
                  <span className="rounded-full border border-emerald-300/[0.12] bg-emerald-300/[0.04] px-2.5 py-1 text-[11px] font-semibold text-emerald-300">Healthy</span>
                </div>
                <div className="mt-5 flex h-52 items-end gap-2 rounded-xl border border-white/[0.04] bg-black/[0.14] px-4 pb-4 pt-8">
                  {chartShapes[active].map((height, index) => (
                    <div key={`${active}-${index}`} className="flex h-full flex-1 items-end">
                      <div
                        className={`w-full rounded-t-md bg-gradient-to-t ${persona.accent} opacity-80 transition-[height] duration-700`}
                        style={{ height: `${height}%`, transitionDelay: `${index * 35}ms` }}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#07141f] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Live activity</p>
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.8)]" />
                </div>
                <div className="mt-4 space-y-2.5">
                  {persona.activity.map(([label, value], index) => (
                    <div key={label} className="rounded-xl border border-white/[0.055] bg-black/[0.11] p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-slate-300">{label}</p>
                        <p className="text-xs font-semibold text-emerald-300">{synced && index === 0 ? "Just now" : value}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-700">{index + 1} minute{index ? "s" : ""} ago</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-300/[0.1] bg-blue-400/[0.03] p-3 text-xs text-blue-100/70">
                  <Check className="h-3.5 w-3.5 text-emerald-300" />
                  {statusText}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-white/[0.018] px-5 py-4 sm:flex-row">
          <div>
            <p className="text-sm font-semibold text-white">Recommended plan: {persona.plan}</p>
            <p className="mt-1 text-sm text-slate-600">The actual dashboard permissions will match this workspace.</p>
          </div>
          <TransitionLink
            href={`/sign-up?plan=${persona.plan.toLowerCase()}`}
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-300 px-5 text-sm font-semibold text-[#021019] transition hover:-translate-y-0.5"
          >
            Build this workspace
            <ArrowRight className="h-4 w-4" />
          </TransitionLink>
        </div>
      </div>
    </section>
  );
}
