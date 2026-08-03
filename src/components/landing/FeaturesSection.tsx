"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Network,
  PackageSearch,
  ShoppingCart,
  Users,
} from "lucide-react";

import styles from "./LandingMotion.module.css";

const capabilities = [
  {
    title: "Inventory and Deck Vault",
    description: "Organize singles, sealed products, graded cards, decks, and exact storage locations.",
    plan: "Free",
    metric: "500+",
    metricLabel: "inventory units",
    preview: ["Exact printing", "Binder locations", "Deck assignment"],
    icon: PackageSearch,
  },
  {
    title: "Collection analytics",
    description: "Track value, growth, and collection history with richer CSV workflows.",
    plan: "Collector",
    metric: "+8.4%",
    metricLabel: "portfolio growth",
    preview: ["Value history", "Market movement", "CSV enrichment"],
    icon: BarChart3,
  },
  {
    title: "Purchasing and CRM",
    description: "Evaluate acquisitions, manage customers, loyalty, store credit, and buying rules.",
    plan: "Seller",
    metric: "31%",
    metricLabel: "margin opportunity",
    preview: ["Photo scan", "Buying rules", "Customer credit"],
    icon: Users,
  },
  {
    title: "Marketplaces and orders",
    description: "Connect sales channels, import orders, and manage fulfillment in one workspace.",
    plan: "Seller",
    metric: "148",
    metricLabel: "orders synchronized",
    preview: ["Channel sync", "Order review", "Inventory reconciliation"],
    icon: Network,
  },
  {
    title: "Card Shows and automation",
    description: "Support seller events, repetitive workflows, and operational review queues.",
    plan: "Seller",
    metric: "42",
    metricLabel: "players checked in",
    preview: ["Show inventory", "Live sales", "Automated tasks"],
    icon: ShoppingCart,
  },
  {
    title: "Store operations",
    description: "Run business intelligence, tasks, staff, vendors, tournaments, payroll, and finances.",
    plan: "Store",
    metric: "5",
    metricLabel: "team seats",
    preview: ["Business intelligence", "Payroll", "Vendor operations"],
    icon: Building2,
  },
];

export function FeaturesSection() {
  const [active, setActive] = useState(2);
  const [autoRotate, setAutoRotate] = useState(true);
  const item = capabilities[active];
  const ActiveIcon = item.icon;

  useEffect(() => {
    if (!autoRotate) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % capabilities.length);
    }, 4300);
    return () => window.clearInterval(timer);
  }, [autoRotate]);

  return (
    <section
      id="platform"
      data-td-reveal
      className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#020a12]"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(37,99,235,.11),transparent_32%)]" />

      <div className="relative mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-28">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">Permission-aware by design</p>
          <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
            Explore the product, not a wall of feature cards.
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-slate-500">
            Select a capability to see how it behaves inside the workspace and
            which plan unlocks it.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            {capabilities.map(({ title, plan, icon: Icon }, index) => {
              const selected = index === active;
              return (
                <button
                  key={title}
                  type="button"
                  onClick={() => {
                    setAutoRotate(false);
                    setActive(index);
                  }}
                  onMouseEnter={() => {
                    setAutoRotate(false);
                    setActive(index);
                  }}
                  className={[
                    "group flex min-h-[78px] items-center gap-4 rounded-2xl border px-4 text-left transition duration-300",
                    selected
                      ? "border-cyan-300/[0.23] bg-gradient-to-r from-blue-500/[0.16] to-cyan-300/[0.05] shadow-[0_18px_55px_rgba(37,99,235,.11)]"
                      : "border-white/[0.065] bg-[#07131f]/80 hover:border-blue-300/[0.15] hover:bg-[#081824]",
                  ].join(" ")}
                >
                  <span className={selected ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-300/[0.09] text-cyan-200" : "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-400/[0.05] text-blue-300/70"}>
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{title}</span>
                    <span className="mt-1 block text-xs text-slate-600">{plan}+ plan</span>
                  </span>
                  <ArrowRight className={selected ? "h-4 w-4 text-cyan-300" : "h-4 w-4 text-slate-700 transition group-hover:text-blue-300"} />
                </button>
              );
            })}
          </div>

          <div
            key={item.title}
            className={`${styles.previewSwap} relative overflow-hidden rounded-[30px] border border-cyan-300/[0.18] bg-gradient-to-br from-[#0a1c2b] via-[#071522] to-[#04101a] p-5 shadow-[0_36px_110px_rgba(0,0,0,.42)] sm:p-7`}
          >
            <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-blue-500/[0.15] blur-[100px]" />
            <div className="relative flex flex-col gap-8 xl:flex-row xl:items-start xl:justify-between">
              <div className="max-w-xl">
                <div className="flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/[0.18] bg-cyan-300/[0.08] text-cyan-200">
                    <ActiveIcon className="h-5 w-5" />
                  </span>
                  <span className="rounded-full border border-blue-300/[0.14] bg-blue-400/[0.05] px-3 py-1.5 text-xs font-semibold text-blue-200">
                    {item.plan}+ plan
                  </span>
                </div>
                <h3 className="mt-6 text-3xl font-semibold tracking-[-0.04em] text-white">{item.title}</h3>
                <p className="mt-4 max-w-lg text-sm leading-7 text-slate-400">{item.description}</p>
              </div>

              <div className="rounded-2xl border border-white/[0.07] bg-black/[0.14] px-5 py-4">
                <p className="text-3xl font-semibold tracking-[-0.04em] text-white">{item.metric}</p>
                <p className="mt-1 text-xs text-slate-600">{item.metricLabel}</p>
              </div>
            </div>

            <div className="relative mt-8 grid gap-3 sm:grid-cols-3">
              {item.preview.map((feature, index) => (
                <div
                  key={feature}
                  className={`${styles.metricRise} rounded-2xl border border-white/[0.07] bg-[#06121d] p-4`}
                  style={{ animationDelay: `${index * 90}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-400/[0.07] text-cyan-300">
                      <Check className="h-4 w-4" />
                    </span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-700">Live</span>
                  </div>
                  <p className="mt-6 text-sm font-semibold text-slate-200">{feature}</p>
                  <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <span className="block h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-300" style={{ width: `${68 + index * 11}%` }} />
                  </div>
                </div>
              ))}
            </div>

            <div className="relative mt-4 flex items-center justify-between rounded-2xl border border-emerald-300/[0.11] bg-emerald-300/[0.035] px-4 py-3">
              <span className="text-xs text-emerald-100/70">Live workspace simulation</span>
              <span className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
                <span className="h-2 w-2 rounded-full bg-emerald-300 shadow-[0_0_12px_rgba(110,231,183,.8)]" />
                Healthy
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
