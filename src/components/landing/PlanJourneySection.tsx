"use client";

import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  Building2,
  Check,
  Layers3,
  PackageSearch,
} from "lucide-react";

import styles from "./LandingMotion.module.css";

const stages = [
  {
    number: "01",
    name: "Free",
    audience: "Start organizing",
    description: "Create a personal workspace with Inventory and Deck Vault.",
    detail: "500 inventory units · 10 decks",
    features: ["Inventory", "Deck Vault", "Personal dashboard"],
    icon: Layers3,
  },
  {
    number: "02",
    name: "Collector",
    audience: "Understand your collection",
    description: "Add collection analytics, value history, and CSV workflows.",
    detail: "10,000 inventory units · 50 decks",
    features: ["Analytics", "Value history", "CSV engine"],
    icon: BarChart3,
  },
  {
    number: "03",
    name: "Seller",
    audience: "Run an online card business",
    description: "Unlock purchasing, CRM, marketplaces, orders, and automation.",
    detail: "50,000 inventory units · Unlimited decks",
    features: ["Purchasing", "CRM", "Orders"],
    icon: PackageSearch,
  },
  {
    number: "04",
    name: "Store",
    audience: "Operate a full storefront",
    description: "Add business intelligence, staff, vendors, tournaments, and payroll.",
    detail: "250,000 inventory units · 5 seats",
    features: ["Business intelligence", "Team controls", "Operations"],
    icon: Building2,
  },
];

export function PlanJourneySection() {
  const [active, setActive] = useState(1);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    if (!autoRotate) return;
    const timer = window.setInterval(() => {
      setActive((current) => (current + 1) % stages.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [autoRotate]);

  return (
    <section
      id="plans"
      data-td-reveal
      className="relative z-10 overflow-hidden border-y border-white/[0.05] bg-[#030b14]"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-blue-500/[0.09] blur-[135px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(100,150,220,.022)_1px,transparent_1px),linear-gradient(90deg,rgba(100,150,220,.022)_1px,transparent_1px)] bg-[size:52px_52px]" />
      </div>

      <div className="relative mx-auto max-w-[1480px] px-4 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28">
        <div className="grid gap-8 lg:grid-cols-[0.78fr_1.22fr] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
              One product, four clear stages
            </p>
            <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl">
              Your workspace grows with you.
            </h2>
            <p className="mt-5 max-w-xl text-base leading-8 text-slate-500">
              Move from collection management to full store operations without
              migrating your data or rebuilding your workflow.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-300/[0.13] bg-[#071522]/85 p-4 shadow-[0_18px_60px_rgba(0,0,0,.2)]">
            <div className="flex items-center gap-3 text-sm text-blue-100/80">
              <ArrowRight className="h-4 w-4 shrink-0 text-cyan-300" />
              The highlighted stage shows what unlocks next.
            </div>
            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span
                key={active}
                className={`${styles.stageFill} block h-full rounded-full bg-gradient-to-r from-cyan-300 to-blue-500`}
              />
            </div>
          </div>
        </div>

        <div className="-mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-4">
          {stages.map(({ number, name, audience, description, detail, features, icon: Icon }, index) => {
            const selected = index === active;
            return (
              <button
                key={name}
                type="button"
                onMouseEnter={() => {
                  setAutoRotate(false);
                  setActive(index);
                }}
                onFocus={() => {
                  setAutoRotate(false);
                  setActive(index);
                }}
                onClick={() => {
                  setAutoRotate(false);
                  setActive(index);
                }}
                className={[
                  "td-spotlight-card group relative min-h-[350px] min-w-[84vw] snap-center md:min-w-0 overflow-hidden rounded-[28px] border p-5 text-left transition duration-500",
                  selected
                    ? "border-cyan-300/[0.26] bg-gradient-to-b from-blue-500/[0.14] via-[#081725] to-[#06111d] shadow-[0_30px_90px_rgba(37,99,235,.15)] xl:-translate-y-3"
                    : "border-white/[0.075] bg-[#07121f]/92 shadow-[0_22px_70px_rgba(0,0,0,.24)] hover:-translate-y-1 hover:border-blue-300/[0.17]",
                ].join(" ")}
              >
                <div className="absolute right-5 top-4 text-5xl font-semibold tracking-[-0.06em] text-white/[0.04]">
                  {number}
                </div>

                <span className={selected ? "flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/[0.2] bg-cyan-300/[0.09] text-cyan-200" : "flex h-12 w-12 items-center justify-center rounded-2xl border border-blue-300/[0.14] bg-blue-400/[0.055] text-blue-300"}>
                  <Icon className="h-5 w-5" />
                </span>

                <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">{audience}</p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-white">{name}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">{description}</p>

                <div className={selected ? "mt-5 space-y-2 opacity-100 transition" : "mt-5 space-y-2 opacity-55 transition"}>
                  {features.map((feature) => (
                    <div key={feature} className="flex items-center gap-2 text-xs text-slate-400">
                      <Check className="h-3.5 w-3.5 text-cyan-300" />
                      {feature}
                    </div>
                  ))}
                </div>

                <div className="absolute inset-x-5 bottom-5 border-t border-white/[0.06] pt-4">
                  <p className="text-xs font-medium text-blue-200/80">{detail}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
