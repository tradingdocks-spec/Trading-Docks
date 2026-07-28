"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  Crown,
  ShieldCheck,
  Sparkles,
  Store,
} from "lucide-react";

import { PLAN_ENTITLEMENTS } from "@/lib/plan-entitlements";

type BillingCycle = "monthly" | "annual";

type LandingPlan = {
  id: "free" | "collector" | "seller" | "business";
  name: string;
  audience: string;
  icon: typeof Sparkles;
  description: string;
  featured?: boolean;
  badge?: string;
  features: readonly string[];
};

const plans: readonly LandingPlan[] = [
  {
    id: "free",
    name: "Free",
    audience: "Explore the platform",
    icon: Sparkles,
    description: "Start organizing cards and exploring Trading Docks.",
    features: [
      "500 inventory units",
      "10 saved decks",
      "Basic market lookups",
      "25-card watchlist",
    ],
  },
  {
    id: "collector",
    name: "Collector",
    audience: "Build your collection",
    icon: Crown,
    description: "Catalog, organize, and track a growing personal collection.",
    features: [
      "10,000 inventory units",
      "50 saved decks",
      "Collection value tracking",
      "CSV import and export",
    ],
  },
  {
    id: "seller",
    name: "Seller",
    audience: "Run your card business",
    icon: ShieldCheck,
    description: "Turn inventory into listings with powerful seller tools.",
    featured: true,
    badge: "Most popular",
    features: [
      "50,000 inventory units",
      "Unlimited saved decks",
      "Marketplace allocations",
      "Pricing and listing queues",
    ],
  },
  {
    id: "business",
    name: "Store",
    audience: "Operate your storefront",
    icon: Store,
    description: "Manage inventory, staff, reporting, and daily operations.",
    badge: "Full platform",
    features: [
      "250,000 inventory units",
      "5 team seats included",
      "Employee roles and controls",
      "Advanced business reports",
    ],
  },
];

function formatPrice(value: number) {
  return value === 0 ? "$0" : `$${value.toFixed(2)}`;
}

export function PricingSection() {
  const [billing, setBilling] = useState<BillingCycle>("annual");

  return (
    <section
      id="pricing"
      className="relative z-10 mx-auto w-full max-w-[1480px] px-5 py-24 sm:px-8 lg:px-12 lg:py-32"
    >
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#20e7ff]">
          Plans for every stage
        </p>
        <h2 className="mt-4 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
          Start collecting. Scale when you&apos;re ready.
        </h2>
        <p className="mt-5 text-base leading-7 text-[#8296aa]">
          Choose the workspace that fits today, from a personal collection to a
          complete store operation.
        </p>

        <div className="mx-auto mt-8 flex w-fit items-center rounded-2xl border border-white/[0.08] bg-white/[0.035] p-1">
          {(["monthly", "annual"] as const).map((cycle) => (
            <button
              key={cycle}
              type="button"
              onClick={() => setBilling(cycle)}
              className={`rounded-xl px-5 py-2.5 text-xs font-semibold capitalize transition ${
                billing === cycle
                  ? "bg-[#20e7ff] text-[#00131a] shadow-[0_8px_25px_rgba(32,231,255,0.2)]"
                  : "text-[#8296aa] hover:text-white"
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
          const displayedPrice =
            billing === "annual"
              ? entitlement.annualPrice / 12
              : entitlement.monthlyPrice;
          const Icon = plan.icon;

          return (
            <article
              key={plan.id}
              className={`relative flex min-h-[550px] flex-col overflow-hidden rounded-[28px] border p-6 transition duration-300 hover:-translate-y-1 ${
                plan.featured
                  ? "border-[#20e7ff]/40 bg-[linear-gradient(180deg,rgba(13,66,79,0.52),rgba(6,21,34,0.98)_38%)] shadow-[0_28px_90px_rgba(0,215,242,0.11)]"
                  : "border-white/[0.08] bg-[#061522] shadow-[0_24px_70px_rgba(0,0,0,0.24)] hover:border-[#20e7ff]/20"
              }`}
            >
              {plan.badge && (
                <div className="absolute right-5 top-5 rounded-full border border-[#20e7ff]/15 bg-[#20e7ff]/[0.08] px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-[#9df5ff]">
                  {plan.badge}
                </div>
              )}

              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.04] text-[#20e7ff]">
                <Icon className="h-5 w-5" />
              </div>

              <p className="mt-5 text-[10px] font-semibold uppercase tracking-[0.17em] text-[#536a80]">
                {plan.audience}
              </p>
              <h3 className="mt-2 text-2xl font-semibold">{plan.name}</h3>

              <div className="mt-5 flex items-end gap-1">
                <span className="text-4xl font-semibold tracking-[-0.045em]">
                  {formatPrice(displayedPrice)}
                </span>
                <span className="pb-1 text-xs text-[#536a80]">/ month</span>
              </div>
              <p className="mt-2 min-h-5 text-[11px] text-[#536a80]">
                {billing === "annual" && entitlement.annualPrice > 0
                  ? `${formatPrice(entitlement.annualPrice)} billed annually`
                  : entitlement.monthlyPrice > 0
                    ? "Billed monthly"
                    : "Free forever"}
              </p>

              <p className="mt-5 min-h-[72px] text-sm leading-6 text-[#8296aa]">
                {plan.description}
              </p>

              <Link
                href={plan.id === "free" ? "/sign-up" : "/pricing"}
                className={`group mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl text-sm font-semibold transition ${
                  plan.featured
                    ? "bg-gradient-to-b from-cyan-300 to-sky-500 text-[#001018] hover:brightness-110"
                    : "border border-white/[0.1] bg-white/[0.04] text-white hover:border-[#20e7ff]/25 hover:bg-[#20e7ff]/[0.06]"
                }`}
              >
                {plan.id === "free" ? "Start free" : `Choose ${plan.name}`}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </Link>

              <div className="mt-7 border-t border-white/[0.07] pt-6">
                <p className="text-xs font-semibold text-white">
                  What&apos;s included
                </p>
                <ul className="mt-4 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="flex gap-2.5 text-xs leading-5 text-[#9aabba]"
                    >
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
        <Link
          href="/pricing"
          className="group inline-flex items-center gap-2 text-sm font-semibold text-[#9df5ff] transition hover:text-white"
        >
          Compare every plan feature
          <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
        </Link>
      </div>
    </section>
  );
}
