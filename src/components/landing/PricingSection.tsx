"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, Check, Crown, ShieldCheck, Sparkles, Store } from "lucide-react";

import { PLAN_ENTITLEMENTS } from "@/lib/plan-entitlements";

const plans = [
  {
    id: "free" as const,
    name: "Free",
    audience: "Explore the platform",
    description: "Start organizing cards and exploring Trading Docks.",
    icon: Sparkles,
    features: ["500 inventory units", "10 saved decks", "Basic market lookups", "25-card watchlist"],
  },
  {
    id: "collector" as const,
    name: "Collector",
    audience: "Build your collection",
    description: "Catalog, organize, and track a growing personal collection.",
    icon: Crown,
    features: ["10,000 inventory units", "50 saved decks", "Collection value tracking", "CSV import and export"],
  },
  {
    id: "seller" as const,
    name: "Seller",
    audience: "Run your card business",
    description: "Turn inventory into listings with powerful seller tools.",
    icon: ShieldCheck,
    badge: "Most popular",
    featured: true,
    features: ["50,000 inventory units", "Unlimited saved decks", "Marketplace allocations", "Pricing and listing queues"],
  },
  {
    id: "business" as const,
    name: "Store",
    audience: "Operate your storefront",
    description: "Manage inventory, staff, reporting, and daily operations.",
    icon: Store,
    badge: "Full platform",
    features: ["250,000 inventory units", "5 team seats included", "Employee roles and controls", "Advanced business reports"],
  },
] as const;

function dollars(value: number) {
  return value === 0 ? "$0" : `$${value.toFixed(2)}`;
}

export function PricingSection() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  return (
    <section id="pricing" className="relative z-10 mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
          Simple pricing for every stage
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
          Choose the tools that fit the way you collect and sell.
        </h2>
        <p className="mt-5 text-base leading-7 text-[#8296aa]">
          Compare Free, Collector, Seller, and Store plans, then upgrade whenever your collection or business is ready.
        </p>

        <div className="mx-auto mt-8 flex w-fit items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] p-1">
          {(["monthly", "annual"] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBilling(cycle)}
              className={`rounded-xl px-5 py-2.5 text-xs font-semibold capitalize transition ${
                billing === cycle ? "bg-[#20e7ff] text-[#00131a]" : "text-[#8296aa] hover:text-white"
              }`}
            >
              {cycle}
              {cycle === "annual" && (
                <span className="ml-2 rounded-full bg-[#00313b] px-2 py-0.5 text-[9px] uppercase tracking-wide text-[#9df5ff]">
                  Save 17%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {plans.map((plan) => {
          const entitlement = PLAN_ENTITLEMENTS[plan.id];
          const price = billing === "annual" ? entitlement.annualPrice / 12 : entitlement.monthlyPrice;
          const Icon = plan.icon;

          return (
            <article
              key={plan.id}
              className={`relative flex min-h-[550px] flex-col rounded-[28px] border p-6 transition duration-300 hover:-translate-y-1 ${
                "featured" in plan && plan.featured
                  ? "border-[#20e7ff]/40 bg-[linear-gradient(180deg,rgba(13,66,79,0.52),rgba(6,21,34,0.98)_38%)] shadow-[0_28px_90px_rgba(0,215,242,0.11)]"
                  : "border-white/[0.08] bg-[#061522] shadow-[0_24px_70px_rgba(0,0,0,0.24)] hover:border-[#20e7ff]/20"
              }`}
            >
              {"badge" in plan && plan.badge && (
                <span className="absolute right-5 top-5 rounded-full border border-[#20e7ff]/15 bg-[#20e7ff]/[0.08] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9df5ff]">
                  {plan.badge}
                </span>
              )}

              <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[#20e7ff]">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#536a80]">{plan.audience}</p>
              <h3 className="mt-2 text-2xl font-semibold">{plan.name}</h3>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-[-0.045em]">{dollars(price)}</span>
                <span className="pb-1 text-xs text-[#536a80]">/ month</span>
              </div>
              <p className="mt-2 min-h-5 text-[11px] text-[#536a80]">
                {billing === "annual" && entitlement.annualPrice > 0
                  ? `${dollars(entitlement.annualPrice)} billed annually`
                  : entitlement.monthlyPrice > 0 ? "Billed monthly" : "Free forever"}
              </p>
              <p className="mt-5 min-h-[72px] text-sm leading-6 text-[#8296aa]">{plan.description}</p>

              <Link
                href={plan.id === "free" ? "/sign-up?plan=free" : `/pricing?plan=${plan.id}`}
                className={`group mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
                  "featured" in plan && plan.featured
                    ? "bg-gradient-to-b from-cyan-300 to-sky-500 text-[#001018] hover:brightness-110"
                    : "border border-white/[0.1] bg-white/[0.04] text-white hover:border-[#20e7ff]/25 hover:bg-[#20e7ff]/[0.06]"
                }`}
              >
                {plan.id === "free" ? "Start free" : `Choose ${plan.name}`}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>

              <div className="mt-7 border-t border-white/[0.07] pt-6">
                <p className="text-xs font-semibold text-white">What&apos;s included</p>
                <ul className="mt-4 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex gap-2.5 text-xs leading-5 text-[#9aabba]">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-[#20e7ff]" />
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          );
        })}
      </div>

      <div className="mt-8 text-center">
        <Link href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-[#20e7ff] hover:text-white">
          Compare every feature
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
