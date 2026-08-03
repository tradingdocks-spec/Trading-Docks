"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
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
} from "lucide-react";

import styles from "./LandingMotion.module.css";

const personas = {
  collector: {
    label: "I’m a collector",
    plan: "Collector",
    tagline: "Understand the value and shape of your collection.",
    metricLabels: ["Collection value", "Inventory", "Saved decks", "30-day growth"],
    metricValues: ["$48,260", "3,842", "27", "+4.8%"],
    syncedValues: ["$48,444", "3,968", "28", "+5.2%"],
    nav: ["Dashboard", "Inventory", "Deck Vault", "Analytics", "CSV Engine"],
    activity: [
      ["Binder value updated", "+$184"],
      ["Collection imported", "126 cards"],
      ["Deck price refreshed", "$428.19"],
    ],
    syncedActivity: [
      ["Collection sync complete", "126 cards"],
      ["Market values refreshed", "+$184"],
      ["Deck Vault indexed", "28 decks"],
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
    syncedValues: ["$286,104", "22,766", "91", "$7,091"],
    nav: ["Purchasing", "Customer CRM", "Marketplaces", "Orders", "Automation"],
    activity: [
      ["Mana Pool synced", "148 orders"],
      ["TCGplayer listing sold", "$42.18"],
      ["Buylist opportunity", "+31% margin"],
    ],
    syncedActivity: [
      ["Mana Pool sync complete", "148 orders"],
      ["Inventory reconciled", "126 listings"],
      ["Profit forecast updated", "+$249"],
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
    syncedValues: ["$129,108", "84,342", "5", "14"],
    nav: ["Business Intelligence", "Tasks", "Tournaments", "Vendors", "Employees"],
    activity: [
      ["Tournament check-in", "42 players"],
      ["Supply order received", "8 cartons"],
      ["Payroll approved", "5 employees"],
    ],
    syncedActivity: [
      ["Store systems synchronized", "8 sources"],
      ["Open tasks recalculated", "14 remaining"],
      ["Revenue dashboard refreshed", "+$688"],
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

const personaOrder: PersonaKey[] = ["collector", "seller", "store"];

export function ExperienceSection() {
  const [active, setActive] = useState<PersonaKey>("seller");
  const [activeNav, setActiveNav] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [synced, setSynced] = useState(false);
  const [autoRotate, setAutoRotate] = useState(true);
  const intervalRef = useRef<number | null>(null);
  const persona = personas[active];
  const Icon = persona.icon;

  useEffect(() => {
    setSynced(false);
    setSyncing(false);
    setActiveNav(0);
  }, [active]);

  useEffect(() => {
    if (!autoRotate) return;
    intervalRef.current = window.setInterval(() => {
      setActive((current) => {
        const index = personaOrder.indexOf(current);
        return personaOrder[(index + 1) % personaOrder.length];
      });
    }, 5500);
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [autoRotate]);

  const statusText = useMemo(() => {
    if (syncing) return "Synchronizing connected systems";
    if (synced) return "Workspace updated just now";
    return "Live product simulation";
  }, [syncing, synced]);

  function choosePersona(key: PersonaKey) {
    setAutoRotate(false);
    setActive(key);
  }

  function runSync() {
    if (syncing) return;
    setAutoRotate(false);
    setSyncing(true);
    setSynced(false);
    window.setTimeout(() => {
      setSyncing(false);
      setSynced(true);
    }, 1450);
  }

  const currentValues = synced ? persona.syncedValues : persona.metricValues;
  const currentActivity = synced ? persona.syncedActivity : persona.activity;

  return (
    <section
      id="experience"
      data-td-reveal
      className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#020912] px-4 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-32"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-[10%] top-[-13rem] h-[34rem] w-[34rem] rounded-full bg-blue-500/[0.11] blur-[145px]" />
        <div className="absolute bottom-[-12rem] right-[8%] h-[30rem] w-[30rem] rounded-full bg-cyan-300/[0.075] blur-[135px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(79,140,220,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(79,140,220,.022)_1px,transparent_1px)] bg-[size:54px_54px]" />
      </div>

      <div className="relative mx-auto max-w-[1480px]">
        <div className="grid gap-8 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/[0.16] bg-cyan-300/[0.05] px-3.5 py-2 text-xs font-semibold text-cyan-200">
              <Sparkles className="h-4 w-4" />
              Build your workspace
            </div>
            <h2 className="mt-5 max-w-[660px] text-4xl font-semibold tracking-[-0.05em] text-white sm:text-5xl lg:text-6xl">
              Watch the product reshape itself around you.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-500">
              Select a workspace type. Navigation, metrics, activity, and the
              recommended plan transform instantly.
            </p>
          </div>

          <div className="-mx-1 flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-[20px] border border-white/[0.075] bg-[#07131f]/88 p-2 shadow-[0_22px_80px_rgba(0,0,0,.24)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:mx-0 sm:grid sm:grid-cols-3 sm:overflow-visible">
            {(Object.keys(personas) as PersonaKey[]).map((key) => {
              const item = personas[key];
              const ItemIcon = item.icon;
              const selected = key === active;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => choosePersona(key)}
                  className={[
                    "group relative flex min-h-[64px] min-w-[210px] snap-start items-center gap-3 overflow-hidden rounded-2xl px-4 text-left transition duration-300",
                    selected
                      ? "bg-gradient-to-r from-blue-500/[0.24] to-cyan-300/[0.09] text-white shadow-[inset_0_0_0_1px_rgba(103,232,249,.18),0_12px_30px_rgba(37,99,235,.13)]"
                      : "text-slate-500 hover:bg-white/[0.035] hover:text-white",
                  ].join(" ")}
                >
                  <span className={selected ? "flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-300/[0.09] text-cyan-200" : "flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.025] text-blue-300/55"}>
                    <ItemIcon className="h-4 w-4" />
                  </span>
                  <span>
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-0.5 block text-[11px] text-slate-600">{item.plan} workspace</span>
                  </span>
                  {selected && autoRotate ? (
                    <span className="absolute inset-x-0 bottom-0 h-[2px] bg-white/[0.06]">
                      <span key={active} className={`${styles.selectorProgress} block h-full bg-gradient-to-r from-cyan-300 to-blue-500`} />
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>

        <div
          key={`${active}-${synced ? "synced" : "base"}`}
          className={`${styles.previewSwap} mt-10 grid overflow-hidden rounded-[24px] border sm:rounded-[34px] border-blue-300/[0.18] bg-[#06131e] shadow-[0_44px_140px_rgba(0,0,0,.56),0_0_90px_rgba(37,99,235,.08)] lg:grid-cols-[260px_1fr]`}
        >
          <aside className="border-b border-white/[0.06] bg-[#030d16] p-4 lg:border-b-0 lg:border-r">
            <div className="flex items-center gap-3 rounded-2xl border border-blue-300/[0.11] bg-blue-400/[0.045] p-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-400/[0.09] text-cyan-200">
                <Icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{persona.plan} workspace</p>
                <p className="mt-0.5 text-xs text-slate-600">Recommended for you</p>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mt-5 lg:block lg:space-y-1 lg:overflow-visible">
              {persona.nav.map((item, index) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setActiveNav(index)}
                  className={[
                    "flex h-10 min-w-max items-center gap-3 rounded-xl px-3 text-left text-sm font-medium transition duration-200",
                    index === activeNav
                      ? "bg-gradient-to-r from-blue-500/[0.19] to-transparent text-white"
                      : "text-slate-500 hover:bg-white/[0.025] hover:text-slate-300",
                  ].join(" ")}
                >
                  <span className={index === activeNav ? "h-1.5 w-1.5 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(103,232,249,.8)]" : "h-1.5 w-1.5 rounded-full bg-slate-800"} />
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 hidden rounded-2xl border lg:mt-6 lg:block border-white/[0.06] bg-white/[0.018] p-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-slate-700">Recommended plan</p>
              <p className="mt-2 text-lg font-semibold text-white">{persona.plan}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">{persona.tagline}</p>
            </div>
          </aside>

          <div className="relative min-w-0 overflow-hidden p-4 sm:p-6 lg:p-7">
            {syncing ? (
              <div className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-r-[34px] bg-blue-500/[0.025]">
                <span className={`${styles.syncSweep} absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-cyan-200/[0.14] to-transparent`} />
              </div>
            ) : null}

            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-cyan-300">Interactive product preview</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.035em] text-white">
                  {persona.nav[activeNav]}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <span className="hidden items-center gap-2 rounded-xl border border-white/[0.06] bg-black/[0.12] px-3 py-2 text-xs text-slate-500 sm:flex">
                  <Search className="h-3.5 w-3.5" />
                  Search your workspace
                </span>
                <button
                  type="button"
                  onClick={runSync}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-cyan-300/[0.18] bg-cyan-300/[0.07] px-3.5 text-xs font-semibold text-cyan-100 transition hover:-translate-y-0.5 hover:bg-cyan-300/[0.11]"
                >
                  <RefreshCw className={syncing ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
                  {syncing ? "Syncing…" : synced ? "Sync again" : "Run live sync"}
                </button>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {persona.metricLabels.map((label, index) => {
                const MetricIcon = [CircleDollarSign, Boxes, PackageCheck, ShoppingBag][index];
                return (
                  <div
                    key={`${active}-${label}-${synced}`}
                    className={`${styles.metricRise} td-spotlight-card rounded-2xl border border-white/[0.075] bg-[#081925] p-4`}
                    style={{ animationDelay: `${index * 70}ms` }}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-slate-600">{label}</p>
                      <MetricIcon className="h-4 w-4 text-blue-300/70" />
                    </div>
                    <p className="mt-4 text-2xl font-semibold tracking-[-0.035em] text-white">{currentValues[index]}</p>
                    <p className="mt-1 text-xs text-emerald-300">
                      {synced ? "Updated just now" : index % 2 === 0 ? "+8.4% this month" : "Updated moments ago"}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-[1fr_390px]">
              <div className="rounded-2xl border border-white/[0.07] bg-[#030d16] p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-white">Workspace momentum</p>
                    <p className="mt-1 text-xs text-slate-600">Live simulation for your selected account type</p>
                  </div>
                  <span className="rounded-full border border-emerald-300/[0.12] bg-emerald-300/[0.04] px-2.5 py-1 text-[11px] font-semibold text-emerald-300">
                    {syncing ? "Syncing" : "Healthy"}
                  </span>
                </div>

                <div className="mt-4 flex h-[150px] sm:mt-5 sm:h-[190px] items-end gap-2 rounded-xl border border-white/[0.045] bg-black/[0.12] px-4 pb-4 pt-8">
                  {chartShapes[active].map((height, index) => (
                    <span
                      key={`${active}-${index}`}
                      className="block flex-1 rounded-t-md bg-gradient-to-t from-cyan-300/80 via-blue-400/85 to-indigo-500/85 shadow-[0_0_18px_rgba(59,130,246,.08)] transition-[height] duration-700"
                      style={{ height: `${Math.max(18, height - (syncing ? 9 : 0) + (synced ? 4 : 0))}%`, transitionDelay: `${index * 35}ms` }}
                    />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-[#071522] p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-white">Live activity</p>
                  <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,.9)]" />
                </div>
                <div className="mt-4 space-y-2.5">
                  {currentActivity.map(([title, value], index) => (
                    <div
                      key={`${active}-${title}-${synced}`}
                      className={`${styles.activitySlide} rounded-xl border border-white/[0.055] bg-black/[0.11] p-3`}
                      style={{ animationDelay: `${index * 80}ms` }}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs font-semibold text-slate-300">{title}</p>
                        <span className="text-xs font-semibold text-emerald-300">{value}</span>
                      </div>
                      <p className="mt-1 text-[11px] text-slate-700">{synced ? "just now" : `${index + 1} minute${index ? "s" : ""} ago`}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-blue-300/[0.11] bg-blue-400/[0.035] px-3 py-2.5 text-xs text-blue-100/75">
                  <Check className="h-3.5 w-3.5 text-cyan-300" />
                  {statusText}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
