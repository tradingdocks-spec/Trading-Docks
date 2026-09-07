"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import { RevenueCatWebPurchaseButton } from "@/components/billing/RevenueCatWebPurchaseButton";
import {
  PLAN_ENTITLEMENTS,
  type AccountTier,
} from "@/lib/plan-entitlements";

type BillingCycle = "monthly" | "annual";

type Plan = {
  id: AccountTier;
  name: string;
  motion: string;
  audience: string;
  description: string;
  annualNote: string;
  recommended?: boolean;
};

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    motion: "Organize",
    audience: "New collections",
    description: "500 cards, 5 decks, scanner, and a clean personal inventory foundation.",
    annualNote: "Free forever",
  },
  {
    id: "collector",
    name: "Collector",
    motion: "Understand",
    audience: "Serious collectors",
    description: "Unlimited collection, price history, storage, trade binder, wishlist, and signals.",
    annualNote: "Best for a growing personal collection",
  },
  {
    id: "seller",
    name: "Seller",
    motion: "Sell",
    audience: "Online sellers",
    description: "Deal Desk, buying sessions, exports, sealed evaluator, and full web workspace.",
    annualNote: "Recommended for weekly buying and listing",
    recommended: true,
  },
  {
    id: "store",
    name: "Store",
    motion: "Operate",
    audience: "Store operators",
    description: "Buying profiles, approvals, customer summaries, inventory, and store operations.",
    annualNote: "Employee accounts not yet available",
  },
];

const comparisonRows = [
  { label: "Cards", values: ["500", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Deck Vault", values: ["5 decks", "Unlimited", "Unlimited", "Unlimited"] },
  { label: "Collection analytics", values: ["Basic", "Full", "Full", "Full"] },
  { label: "Trade binder and wishlist", values: ["No", "Yes", "Yes", "Yes"] },
  { label: "Purchasing workflows", values: ["No", "No", "Deal Desk + sessions", "Shared workflows"] },
  { label: "Web seller workspace", values: ["No", "No", "Yes", "Yes"] },
  { label: "CSV/email export", values: ["No", "No", "Yes", "Yes"] },
  { label: "Business intelligence", values: ["No", "No", "Seller view", "Store view"] },
  { label: "Store operations", values: ["No", "No", "No", "Yes"] },
  { label: "Employee accounts", values: ["No", "No", "No", "Not yet available"] },
];

function formatPrice(value: number) {
  return value === 0 ? "$0" : `$${value.toFixed(value % 1 === 0 ? 0 : 2)}`;
}

function displayPrice(plan: Plan, billing: BillingCycle) {
  const entitlement = PLAN_ENTITLEMENTS[plan.id];
  return billing === "annual"
    ? formatPrice(entitlement.annualMonthlyPrice)
    : formatPrice(entitlement.monthlyPrice);
}

function billingDetail(plan: Plan, billing: BillingCycle) {
  const entitlement = PLAN_ENTITLEMENTS[plan.id];
  if (entitlement.monthlyPrice === 0) return "Free forever";
  if (billing === "annual") return `${formatPrice(entitlement.annualPrice)} billed annually`;
  return "Billed monthly";
}

function planAction(plan: Plan, currentPlan: AccountTier | null, publicView: boolean) {
  if (!publicView && plan.id === currentPlan) return "Current plan";
  if (plan.id === "free") return "Use Free";
  return `Choose ${plan.name}`;
}

export function TieredPlanComparison({
  currentPlan,
  publicView = false,
}: {
  currentPlan: AccountTier | null;
  publicView?: boolean;
}) {
  const [billing, setBilling] = useState<BillingCycle>("monthly");
  const Container = publicView ? "main" : "div";

  return (
    <Container className="min-h-full bg-[#03080d] px-5 py-8 text-white sm:px-8 lg:px-12">
      <div className="mx-auto max-w-[1480px]">
        <Link
          href={publicView ? "/" : "/dashboard"}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition hover:text-cyan-200"
        >
          <ArrowLeft className="h-4 w-4" />
          {publicView ? "Back to Trading Docks" : "Back to Dashboard"}
        </Link>

        <header className="grid gap-8 border-b border-white/[0.08] py-10 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="max-w-3xl">
            <p className="text-sm font-medium text-cyan-200">Pricing</p>
            <h1 className="mt-4 text-5xl font-semibold leading-[0.98] tracking-[-0.055em] sm:text-6xl">
              Choose the plan that fits your collection.
            </h1>
            <p className="mt-5 text-base leading-8 text-slate-400">
              Trading Docks progresses from collection organization to market
              understanding, selling operations, and store management. Compare
              the included tools and choose monthly or annual billing.
            </p>
          </div>

          <div className="flex w-fit items-center border border-white/[0.1] p-1" role="group" aria-label="Billing cycle">
            {(["monthly", "annual"] as const).map((cycle) => (
              <button
                key={cycle}
                type="button"
                onClick={() => setBilling(cycle)}
                aria-pressed={billing === cycle}
                className={[
                  "h-10 px-4 text-sm font-semibold capitalize transition",
                  billing === cycle
                    ? "bg-cyan-300 text-[#01131a]"
                    : "text-slate-400 hover:text-white",
                ].join(" ")}
              >
                {cycle}
              </button>
            ))}
          </div>
        </header>

        <section className="grid border-b border-white/[0.08] lg:grid-cols-4">
          {plans.map((plan, index) => {
            const isCurrent = !publicView && plan.id === currentPlan;
            const revenueCatPlan =
              plan.id === "collector" || plan.id === "seller" || plan.id === "store"
                ? plan.id
                : null;

            return (
              <article
                key={plan.id}
                className="border-b border-white/[0.08] py-7 lg:border-b-0 lg:border-r lg:px-6 lg:last:border-r-0"
              >
                <div className="flex min-h-6 items-center justify-between gap-4">
                  <span className="text-xs text-slate-400">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  {plan.recommended ? (
                    <span className="text-xs font-semibold text-cyan-200">
                      Seller recommendation
                    </span>
                  ) : null}
                </div>
                <p className="mt-5 text-sm font-semibold text-slate-400">{plan.motion}</p>
                <h2 className="mt-1 text-3xl font-semibold tracking-[-0.04em]">
                  {plan.name}
                </h2>
                <p className="mt-1 text-sm text-slate-400">{plan.audience}</p>
                <div className="mt-7">
                  <span className="text-4xl font-semibold tracking-[-0.05em]">
                    {displayPrice(plan, billing)}
                  </span>
                  <span className="ml-2 text-sm text-slate-400">/ month</span>
                </div>
                <p className="mt-2 text-xs text-slate-400">{billingDetail(plan, billing)}</p>
                <p className="mt-5 min-h-[96px] text-sm leading-6 text-slate-400">
                  {plan.description}
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-400">{plan.annualNote}</p>

                {publicView ? (
                  <Link
                    href={
                      plan.id === "free"
                        ? "/sign-up"
                        : `/sign-up?plan=${plan.id}&billing=${billing}`
                    }
                    className={[
                      "mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition",
                      plan.recommended
                        ? "bg-cyan-300 text-[#01131a] hover:bg-cyan-200"
                        : "border border-white/[0.12] text-slate-200 hover:border-cyan-200/35 hover:text-white",
                    ].join(" ")}
                  >
                    {planAction(plan, currentPlan, publicView)}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : isCurrent || plan.id === "free" || currentPlan !== "free" ? (
                  <Link
                    href={currentPlan !== "free" ? "/dashboard/settings" : "/dashboard"}
                    aria-current={isCurrent ? "true" : undefined}
                    className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-white/[0.12] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/35 hover:text-white"
                  >
                    {currentPlan !== "free" && !isCurrent
                      ? "Change in billing portal"
                      : planAction(plan, currentPlan, publicView)}
                    {!isCurrent ? <ArrowRight className="h-4 w-4" /> : null}
                  </Link>
                ) : revenueCatPlan ? (
                  <div className="mt-6">
                    <RevenueCatWebPurchaseButton
                      plan={revenueCatPlan}
                      billing={billing}
                      label={planAction(plan, currentPlan, publicView)}
                      featured={false}
                    />
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>

        <section className="grid min-w-0 gap-8 py-10 lg:grid-cols-[300px_minmax(0,1fr)]">
          <div>
            <p className="text-sm font-semibold text-white">Capability matrix</p>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Compare the tools and limits included with each plan.
            </p>
          </div>
          <div className="min-w-0 overflow-x-auto" role="region" aria-label="Full plan comparison" tabIndex={0}>
            <table className="w-full min-w-[860px] border-collapse text-left">
              <caption className="sr-only">Plan features and limits.</caption>
              <thead>
                <tr className="border-b border-white/[0.08] text-xs text-slate-400">
                  <th className="py-3 pr-6 font-medium">Capability</th>
                  {plans.map((plan) => (
                    <th key={plan.id} className="px-4 py-3 font-medium">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-white/[0.055] text-sm last:border-b-0"
                  >
                    <td className="py-4 pr-6 font-medium text-slate-300">{row.label}</td>
                    {row.values.map((value, index) => (
                      <td key={`${row.label}-${plans[index].id}`} className="px-4 py-4 leading-6 text-slate-400">
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-4 border-t border-white/[0.08] py-8 md:grid-cols-3">
          {[
            ["No surprise fees", "Clear plan limits and straightforward monthly or annual billing."],
            ["Upgrade without rebuilding", "Your workspace history, inventory, and account identity stay intact."],
            ["Employee accounts", "Employee access is not yet available. Store pricing does not include active employee seats."],
          ].map(([title, copy]) => (
            <div key={title} className="border-l border-white/[0.08] pl-4">
              <h3 className="text-sm font-semibold text-white">{title}</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">{copy}</p>
            </div>
          ))}
        </section>
      </div>
    </Container>
  );
}
