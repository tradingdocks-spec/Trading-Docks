import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-catalog";

type PublicPlan = {
  id: MembershipTier;
  audience: string;
  motion: string;
  bestFor: string;
  cta: string;
  recommended?: boolean;
};

const PLAN_ORDER: MembershipTier[] = ["free", "collector", "seller", "store"];

const PLAN_POSITIONING: Record<MembershipTier, Omit<PublicPlan, "id">> = {
  free: {
    audience: "New collections",
    motion: "Organize",
    bestFor: "500 cards, 5 decks, scanner, and basic collection structure.",
    cta: "Start free",
  },
  collector: {
    audience: "Serious collectors",
    motion: "Understand",
    bestFor: "Unlimited collection, value history, storage, binder, wishlist, and signals.",
    cta: "Choose Collector",
  },
  seller: {
    audience: "Online sellers",
    motion: "Sell",
    bestFor: "Deal Desk, buying sessions, sealed evaluation, exports, and full web workspace.",
    cta: "Choose Seller",
    recommended: true,
  },
  store: {
    audience: "Store operators",
    motion: "Operate",
    bestFor: "Shared workflows, approvals, employees, sessions, inventory, and operations.",
    cta: "Choose Store",
  },
};

const COMPARISON_ROWS: Array<{
  label: string;
  values: Record<MembershipTier, string>;
}> = [
  {
    label: "Card capacity",
    values: {
      free: "500",
      collector: "Unlimited",
      seller: "Unlimited",
      store: "Unlimited",
    },
  },
  {
    label: "Deck capacity",
    values: {
      free: "5",
      collector: "Unlimited",
      seller: "Unlimited",
      store: "Unlimited",
    },
  },
  {
    label: "Collection intelligence",
    values: {
      free: "Basic",
      collector: "Value, history, storage",
      seller: "Included",
      store: "Included",
    },
  },
  {
    label: "Buying and selling",
    values: {
      free: "Not included",
      collector: "Not included",
      seller: "Deal Desk, sessions, exports",
      store: "Shared business workflows",
    },
  },
  {
    label: "Team operations",
    values: {
      free: "Not included",
      collector: "Not included",
      seller: "Solo operation",
      store: "Employee accounts pending configuration",
    },
  },
];

function publicPlan(id: MembershipTier): PublicPlan {
  return { id, ...PLAN_POSITIONING[id] };
}

function formatMonthlyPrice(tier: MembershipTier) {
  const price = MEMBERSHIP_PLANS[tier].monthlyPrice;
  return price === 0 ? "$0" : `$${price.toFixed(2)}`;
}

function formatAnnualPrice(tier: MembershipTier) {
  const price = MEMBERSHIP_PLANS[tier].annualPrice;
  return price === 0 ? "No annual billing" : `$${price.toFixed(2)} / year`;
}

function signupHref(tier: MembershipTier) {
  return `/sign-up?plan=${tier}`;
}

export function PricingSection() {
  const plans = PLAN_ORDER.map(publicPlan);

  return (
    <section
      id="pricing"
      className="relative border-y border-white/[0.06] bg-[#03080d] px-5 py-16 text-white sm:px-8 sm:py-20 lg:px-12"
    >
      <div className="mx-auto max-w-[1480px]">
        <div className="grid gap-10 lg:grid-cols-[360px_1fr]">
          <div>
            <p className="text-sm font-medium text-cyan-200">Plans</p>
            <h2 className="mt-4 text-4xl font-semibold leading-[0.98] tracking-[-0.05em] sm:text-5xl">
              A workspace that grows by function, not decoration.
            </h2>
            <p className="mt-5 text-sm leading-7 text-slate-500">
              Trading Docks plans progress through the real lifecycle:
              organize the collection, understand value, sell inventory, then
              operate a team.
            </p>
          </div>

          <div className="min-w-0">
            <div className="grid border-y border-white/[0.08] md:grid-cols-4">
              {plans.map((plan, index) => (
                <article
                  key={plan.id}
                  className="border-b border-white/[0.08] py-6 md:border-b-0 md:border-r md:px-5 md:last:border-r-0"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-xs text-slate-600">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {plan.recommended ? (
                      <span className="text-xs font-semibold text-cyan-200">
                        Recommended for sellers
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-5 text-sm font-semibold text-slate-400">{plan.motion}</p>
                  <h3 className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-white">
                    {MEMBERSHIP_PLANS[plan.id].name}
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">{plan.audience}</p>
                  <div className="mt-6">
                    <span className="text-3xl font-semibold tracking-[-0.045em]">
                      {formatMonthlyPrice(plan.id)}
                    </span>
                    <span className="ml-2 text-sm text-slate-600">/ month</span>
                  </div>
                  <p className="mt-2 text-xs text-slate-600">{formatAnnualPrice(plan.id)}</p>
                  <p className="mt-5 min-h-[84px] text-sm leading-6 text-slate-400">
                    {plan.bestFor}
                  </p>
                  <Link
                    href={signupHref(plan.id)}
                    className={[
                      "mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold transition",
                      plan.recommended
                        ? "bg-cyan-300 text-[#01131a] hover:bg-cyan-200"
                        : "border border-white/[0.12] text-slate-200 hover:border-cyan-200/35 hover:text-white",
                    ].join(" ")}
                  >
                    {plan.cta}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </article>
              ))}
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full min-w-[860px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-white/[0.08] text-xs text-slate-600">
                    <th className="py-3 pr-6 font-medium">Capability</th>
                    {plans.map((plan) => (
                      <th key={plan.id} className="px-4 py-3 font-medium">
                        {MEMBERSHIP_PLANS[plan.id].name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_ROWS.map((row) => (
                    <tr
                      key={row.label}
                      className="border-b border-white/[0.055] text-sm last:border-b-0"
                    >
                      <td className="py-4 pr-6 font-medium text-slate-300">{row.label}</td>
                      {plans.map((plan) => (
                        <td key={plan.id} className="px-4 py-4 leading-6 text-slate-500">
                          {row.values[plan.id]}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-8 flex flex-col justify-between gap-4 border-t border-white/[0.08] pt-6 sm:flex-row sm:items-center">
              <p className="max-w-2xl text-sm leading-6 text-slate-500">
                Seller is recommended for users who buy and sell weekly. Store
                is for shared operations; employee capacity remains configurable
                rather than an invented fixed seat count.
              </p>
              <Link
                href="/pricing"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-[10px] border border-white/[0.12] px-4 text-sm font-semibold text-slate-200 transition hover:border-cyan-200/35 hover:text-white"
              >
                Full comparison
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
