"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Crown,
  HelpCircle,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  X,
} from "lucide-react";
import { PLAN_ENTITLEMENTS } from "@/lib/plan-entitlements";

type BillingCycle = "monthly" | "annual";

type Plan = {
  id: "free" | "collector" | "seller" | "store";
  name: string;
  audience: string;
  monthlyPrice: number;
  annualMonthlyPrice: number;
  annualPrice: number;
  description: string;
  badge?: string;
  features: string[];
  limitations: string[];
};

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    audience: "Explore Trading Docks",
    monthlyPrice: PLAN_ENTITLEMENTS.free.monthlyPrice,
    annualMonthlyPrice: PLAN_ENTITLEMENTS.free.annualMonthlyPrice,
    annualPrice: PLAN_ENTITLEMENTS.free.annualPrice,
    description:
      "A simple starting point for discovering the platform and following your favorite cards.",
    features: [
      "Personal dashboard",
      "Up to 500 cards",
      "Up to 5 decks",
      "Card scanner",
      "Basic collection tools",
    ],
    limitations: ["No unlimited collection", "No seller tools"],
  },
  {
    id: "collector",
    name: "Collector",
    audience: "Organize a personal collection",
    monthlyPrice: PLAN_ENTITLEMENTS.collector.monthlyPrice,
    annualMonthlyPrice: PLAN_ENTITLEMENTS.collector.annualMonthlyPrice,
    annualPrice: PLAN_ENTITLEMENTS.collector.annualPrice,
    description:
      "Catalog, organize, and understand a growing personal card collection without seller complexity.",
    features: [
      "Everything in Free",
      "Unlimited cards and decks",
      "Storage locations and capacity",
      "Put-away and movement history",
      "Collection value tracking",
      "Collection value and price history",
      "Financial insights",
      "Trade binder, wishlist, and market signals",
    ],
    limitations: ["No Deal Desk", "No full web seller workspace"],
  },
  {
    id: "seller",
    name: "Seller",
    audience: "Run an online card business",
    monthlyPrice: PLAN_ENTITLEMENTS.seller.monthlyPrice,
    annualMonthlyPrice: PLAN_ENTITLEMENTS.seller.annualMonthlyPrice,
    annualPrice: PLAN_ENTITLEMENTS.seller.annualPrice,
    description:
      "Turn inventory into listings with the daily pricing, intake, and marketplace tools sellers need.",
    features: [
      "Everything in Collector",
      "Deal Desk",
      "Buying profiles and buying sessions",
      "Trade calculator",
      "Card-show tools",
      "Sealed evaluator",
      "CSV/email export",
      "Full web workspace access",
    ],
    limitations: ["No employee accounts", "No shared store workflows"],
  },
  {
    id: "store",
    name: "Store",
    audience: "Operate a team and storefront",
    monthlyPrice: PLAN_ENTITLEMENTS.store.monthlyPrice,
    annualMonthlyPrice: PLAN_ENTITLEMENTS.store.annualMonthlyPrice,
    annualPrice: PLAN_ENTITLEMENTS.store.annualPrice,
    description:
      "The complete Trading Docks command center for stores managing inventory, staff, and performance.",
    badge: "Full platform",
    features: [
      "Everything in Seller",
      "Employee accounts",
      "Shared buying profiles",
      "Approval limits",
      "Shared sessions",
      "Customer-facing trade summaries",
      "Shared inventory access",
      "Store operations tools",
    ],
    limitations: ["Employee capacity pending product configuration"],
  },
];

const comparisonRows = [
  { label: "Deck Vault decks", values: ["5", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Cards", values: ["500", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Collection analytics", values: [false, true, true, true] },
  { label: "Trade binder and wishlist", values: [false, true, true, true] },
  { label: "Purchasing workflows", values: [false, false, true, true] },
  { label: "Deal Desk", values: [false, false, true, true] },
  { label: "Full web workspace", values: [false, false, true, true] },
  { label: "CSV/email export", values: [false, false, true, true] },
  { label: "Business Intelligence", values: [false, false, false, true] },
  { label: "Store operations", values: [false, false, false, true] },
  { label: "Employee accounts", values: ["No", "No", "No", "Capacity pending"] },
]

function formatPrice(value: number) {
  return value === 0 ? "$0" : `$${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
}

function planAction(plan: Plan, currentPlan: string) {
  if (plan.id === currentPlan) return "Current plan";
  if (plan.id === "free") return "Use Free";
  return plan.id === "store" ? "Choose Store" : `Choose ${plan.name}`;
}

export function PlanComparison({ currentPlan }: { currentPlan: string }) {
  const [billing, setBilling] = useState<BillingCycle>("monthly");

  return (
    <div className="min-h-full bg-td-canvas px-4 py-8 text-td-primary sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1440px]">
        <Link
          href="/dashboard/inventory"
          className="inline-flex items-center gap-2 text-sm font-medium text-td-secondary transition hover:text-td-accent-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Inventory
        </Link>

        <header className="mx-auto max-w-3xl pb-10 pt-10 text-center">
          <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-td-accent/15 bg-td-accent/[0.06] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-td-accent-text">
            <Sparkles className="h-3.5 w-3.5" />
            Plans built to grow with you
          </div>
          <h1 className="mt-5 text-4xl font-semibold tracking-[-0.045em] sm:text-5xl">
            Choose the workspace that fits.
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-7 text-td-secondary sm:text-base">
            Start free, organize a personal collection, grow an online sales operation,
            or run your entire store from one connected platform.
          </p>

          <div className="mx-auto mt-7 flex w-fit items-center rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.035] p-1">
            {(["monthly", "annual"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBilling(cycle)}
                className={`rounded-xl px-5 py-2.5 text-xs font-semibold capitalize transition ${
                  billing === cycle
                    ? "bg-td-accent text-td-on-accent shadow-[0_8px_25px_rgb(var(--td-accent-rgb)/0.22)]"
                    : "text-td-secondary hover:text-td-primary"
                }`}
              >
                {cycle}
                {cycle === "annual" && (
                  <span className="ml-2 rounded-full bg-td-raised px-2 py-0.5 text-[11px] uppercase tracking-wide text-td-accent-text">
                    Save up to 25%
                  </span>
                )}
              </button>
            ))}
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => {
            const price =
              billing === "annual" ? plan.annualMonthlyPrice : plan.monthlyPrice;
            const isCurrent = plan.id === currentPlan;
            return (
              <article
                key={plan.id}
                className="group relative flex min-h-[680px] flex-col overflow-hidden rounded-[28px] border border-td-ink/[0.08] bg-td-surface p-6 transition-all duration-300 hover:-translate-y-1 hover:border-td-accent/40 hover:bg-[linear-gradient(180deg,rgb(var(--td-accent-rgb)/0.48),rgb(var(--td-surface-rgb)/0.96)_35%)] hover:shadow-[0_25px_80px_rgb(var(--td-accent-rgb)/0.11)]"
              >
                {plan.badge && (
                  <div className="absolute right-5 top-5 rounded-full border border-td-accent/15 bg-td-accent/[0.08] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-td-accent-text">
                    {plan.badge}
                  </div>
                )}
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-td-ink/[0.08] bg-td-ink/[0.04] text-td-accent-text">
                  {plan.id === "free" && <Sparkles className="h-5 w-5" />}
                  {plan.id === "collector" && <Crown className="h-5 w-5" />}
                  {plan.id === "seller" && <ShieldCheck className="h-5 w-5" />}
                  {plan.id === "store" && <Store className="h-5 w-5" />}
                </div>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.17em] text-td-muted">
                  {plan.audience}
                </p>
                <h2 className="mt-2 text-2xl font-semibold">{plan.name}</h2>
                <div className="mt-5 flex items-end gap-1">
                  <span className="text-4xl font-semibold tracking-[-0.045em]">
                    {formatPrice(price)}
                  </span>
                  <span className="pb-1 text-xs text-td-muted">/ month</span>
                </div>
                <p className="mt-2 min-h-5 text-[11px] text-td-muted">
                  {billing === "annual" && plan.annualPrice > 0
                    ? `${formatPrice(plan.annualPrice)} billed annually`
                    : plan.monthlyPrice > 0
                      ? "Billed monthly"
                      : "Free forever"}
                </p>
                <p className="mt-5 min-h-[72px] text-sm leading-6 text-td-secondary">
                  {plan.description}
                </p>
                <Link
                  href={isCurrent ? "/dashboard/settings" : `/dashboard/settings?plan=${plan.id}&billing=${billing}`}
                  aria-current={isCurrent ? "true" : undefined}
                  className="mt-5 inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-td-ink/[0.1] bg-td-ink/[0.04] text-sm font-semibold text-td-on-accent transition group-hover:border-td-accent group-hover:bg-td-accent group-hover:text-td-on-accent group-hover:shadow-[0_10px_30px_rgb(var(--td-accent-rgb)/0.18)]"
                >
                  {planAction(plan, currentPlan)}
                  {!isCurrent && <ArrowRight className="h-4 w-4" />}
                </Link>
                <div className="mt-7 border-t border-td-ink/[0.07] pt-6">
                  <p className="text-xs font-semibold text-td-primary">What&apos;s included</p>
                  <ul className="mt-4 space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex gap-2.5 text-xs leading-5 text-td-secondary">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-td-accent-text" />
                        {feature}
                      </li>
                    ))}
                    {plan.limitations.map((limitation) => (
                      <li key={limitation} className="flex gap-2.5 text-xs leading-5 text-td-muted">
                        <X className="mt-0.5 h-4 w-4 shrink-0" />
                        {limitation}
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-10 overflow-hidden rounded-[28px] border border-td-ink/[0.08] bg-td-surface">
          <div className="border-b border-td-ink/[0.07] p-6 sm:p-8">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-td-accent-text">
              Detailed comparison
            </p>
            <h2 className="mt-2 text-2xl font-semibold">Compare Inventory features</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left">
              <thead>
                <tr className="border-b border-td-ink/[0.07] text-xs text-td-secondary">
                  <th className="p-5 font-medium sm:px-8">Feature</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="p-5 font-semibold text-td-primary">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr key={row.label} className="border-b border-td-ink/[0.05] last:border-0">
                    <td className="p-5 text-xs font-medium text-td-secondary sm:px-8">{row.label}</td>
                    {row.values.map((value, index) => (
                      <td key={`${row.label}-${plans[index].id}`} className="p-5 text-xs text-td-secondary">
                        {value === true ? (
                          <Check className="h-4 w-4 text-td-accent-text" aria-label="Included" />
                        ) : value === false ? (
                          <span className="text-td-muted">—</span>
                        ) : (
                          value
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            [ShieldCheck, "No surprise fees", "Clear plan limits and straightforward monthly or annual billing."],
            [Users, "Upgrade as you grow", "Move plans without rebuilding your inventory or losing your history."],
            [HelpCircle, "Need help choosing?", "Start with the plan that fits today. Your workspace can grow later."],
          ].map(([Icon, title, copy]) => {
            const FeatureIcon = Icon as typeof ShieldCheck;
            return (
              <div key={title as string} className="rounded-2xl border border-td-ink/[0.07] bg-td-ink/[0.025] p-5">
                <FeatureIcon className="h-5 w-5 text-td-accent-text" />
                <h3 className="mt-4 text-sm font-semibold">{title as string}</h3>
                <p className="mt-2 text-xs leading-5 text-td-muted">{copy as string}</p>
              </div>
            );
          })}
        </section>
      </div>
    </div>
  );
}
