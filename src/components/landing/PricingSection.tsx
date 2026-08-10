"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Building2,
  Check,
  ChevronRight,
  Database,
  Layers3,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";

import { MEMBERSHIP_PLANS, type MembershipTier } from "@/lib/membership-catalog";

import styles from "./LandingMotion.module.css";

type PlanCard = {
  id: MembershipTier;
  name: string;
  eyebrow: string;
  price: string;
  cadence: string;
  description: string;
  inventory: string;
  decks: string;
  seats: string;
  features: string[];
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  cta: string;
  featured?: boolean;
  badge?: string;
};

const PLAN_ICONS: Record<MembershipTier, React.ComponentType<{ className?: string }>> = {
  free: Layers3,
  collector: BarChart3,
  seller: PackageSearch,
  store: Building2,
};

const PLAN_COPY: Record<
  MembershipTier,
  Pick<PlanCard, "eyebrow" | "description" | "cta" | "featured" | "badge">
> = {
  free: {
    eyebrow: "Start organizing",
    description:
      "Build a clean foundation for a personal collection with essential inventory and deck tools.",
    cta: "Start free",
  },
  collector: {
    eyebrow: "For serious collectors",
    description:
      "Track a growing collection with value history, storage, trade binder, wishlist, and market signals.",
    cta: "Choose Collector",
  },
  seller: {
    eyebrow: "Run an online card business",
    description:
      "Manage buying, Deal Desk workflows, exports, sealed evaluation, and the full web workspace.",
    cta: "Start selling",
    featured: true,
    badge: "Most popular",
  },
  store: {
    eyebrow: "Operate a full storefront",
    description:
      "Coordinate shared buying, approvals, sessions, customer summaries, inventory, and store operations.",
    cta: "Choose Store",
  },
};

function formatPrice(price: number) {
  return price === 0 ? "$0" : `$${price.toFixed(2)}`;
}

function formatLimit(limit: number | null) {
  return limit == null ? "Unlimited" : limit.toLocaleString();
}

function formatEmployeeLimit(
  limit: (typeof MEMBERSHIP_PLANS)[MembershipTier]["limits"]["employeeAccounts"],
) {
  if (limit.kind === "not_included") return "Not included";
  if (limit.kind === "pending_configuration") return "Configurable";
  return "Configurable";
}

function planCard(tier: MembershipTier): PlanCard {
  const plan = MEMBERSHIP_PLANS[tier];
  const copy = PLAN_COPY[tier];
  return {
    id: tier,
    name: plan.name,
    eyebrow: copy.eyebrow,
    price: formatPrice(plan.monthlyPrice),
    cadence: plan.monthlyPrice === 0 ? "forever" : "per month",
    description: copy.description,
    inventory: formatLimit(plan.limits.cardLimit),
    decks: formatLimit(plan.limits.deckLimit),
    seats: formatEmployeeLimit(plan.limits.employeeAccounts),
    features: plan.features.slice(0, 4),
    icon: PLAN_ICONS[tier],
    href: `/sign-up?plan=${tier}`,
    cta: copy.cta,
    featured: copy.featured,
    badge: copy.badge,
  };
}

const plans: PlanCard[] = [
  planCard("free"),
  planCard("collector"),
  planCard("seller"),
  planCard("store"),
];

const trustPoints = [
  {
    icon: ShieldCheck,
    title: "No hidden feature drift",
    text: "The permissions shown here match the product exactly.",
  },
  {
    icon: Database,
    title: "Clear account limits",
    text: "Inventory, deck, and team limits are visible before signup.",
  },
  {
    icon: WandSparkles,
    title: "Upgrade when ready",
    text: "Start small and move up without rebuilding your workspace.",
  },
];

export function PricingSection() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden border-y border-white/[0.05] bg-[#020914] px-4 py-20 sm:px-6 sm:py-24 lg:px-8"
    >
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-[-18rem] h-[42rem] w-[42rem] -translate-x-1/2 rounded-full bg-blue-500/[0.10] blur-[140px]" />
        <div className="absolute bottom-[-14rem] right-[-12rem] h-[32rem] w-[32rem] rounded-full bg-cyan-300/[0.06] blur-[130px]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(100,150,220,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(100,150,220,.025)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
      </div>

      <div className="relative mx-auto max-w-[1480px]">
        <div className="mx-auto max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-blue-300/[0.15] bg-blue-400/[0.055] px-3.5 py-2 text-xs font-semibold text-blue-200">
            <Sparkles className="h-4 w-4" />
            Plans built around how you actually use Trading Docks
          </div>

          <h2 className="mt-6 text-4xl font-semibold tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
            Start with your collection.
            <span className="block bg-gradient-to-r from-cyan-200 via-blue-300 to-blue-500 bg-clip-text text-transparent">
              Scale into a real operation.
            </span>
          </h2>

          <p className="mx-auto mt-6 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg">
            Every plan has a clear purpose, honest limits, and a direct path to
            the next stage of your collection or business.
          </p>
        </div>

        <div className="-mx-4 mt-10 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:mx-0 md:grid md:grid-cols-2 md:px-0 xl:grid-cols-4">
          {plans.map((plan) => (
            <PricingCard key={plan.id} plan={plan} />
          ))}
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-3">
          {trustPoints.map(({ icon: Icon, title, text }) => (
            <div
              key={title}
              className="flex items-start gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.018] p-4"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-blue-300/[0.12] bg-blue-400/[0.05] text-blue-300">
                <Icon className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">{title}</p>
                <p className="mt-1 text-sm leading-6 text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col items-stretch justify-between gap-5 rounded-[28px] border border-blue-300/[0.12] bg-gradient-to-r from-blue-500/[0.07] via-white/[0.025] to-cyan-300/[0.045] px-6 py-6 sm:flex-row sm:px-8">
          <div className="flex items-start gap-4">
            <span className="hidden h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-blue-300/[0.14] bg-[#07121f] text-cyan-300 sm:flex">
              <BadgeCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-base font-semibold text-white">
                Need the full feature matrix?
              </p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Compare every limit, workflow, and permission before choosing a
                plan.
              </p>
            </div>
          </div>

          <Link
            href="/pricing"
            className="inline-flex h-12 w-full shrink-0 sm:w-auto items-center justify-center gap-2 rounded-xl border border-blue-300/[0.18] bg-[#07121f] px-5 text-sm font-semibold text-blue-100 transition hover:-translate-y-0.5 hover:border-blue-300/[0.32] hover:bg-blue-400/[0.08]"
          >
            Compare all features
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function PricingCard({ plan }: { plan: PlanCard }) {
  const Icon = plan.icon;

  return (
    <article
      className={[
        `${styles.shimmer} td-spotlight-card group relative flex min-h-[610px] min-w-[88vw] snap-center flex-col md:min-w-0 overflow-hidden rounded-[30px] border p-5 transition duration-300 sm:p-6`,
        plan.featured
          ? "border-blue-300/[0.28] bg-gradient-to-b from-blue-500/[0.12] via-[#081523] to-[#06101b] shadow-[0_28px_90px_rgba(37,99,235,.16)]"
          : "border-white/[0.075] bg-[#07111d] hover:-translate-y-1 hover:border-blue-300/[0.16] hover:shadow-[0_22px_70px_rgba(0,0,0,.28)]",
      ].join(" ")}
    >
      {plan.featured ? (
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-400/[0.16] blur-[90px]" />
      ) : null}

      <div className="relative">
        <div className="mb-5 flex min-h-7 items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-slate-700">
            {plan.featured ? "Recommended" : "Trading Docks plan"}
          </span>
          {plan.featured ? (
            <span className="shrink-0 rounded-full border border-cyan-200/[0.22] bg-cyan-200/[0.09] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-cyan-100">
              {plan.badge}
            </span>
          ) : null}
        </div>

        <div className="flex items-start gap-3">
          <span
            className={[
              "flex h-11 w-11 items-center justify-center rounded-2xl border",
              plan.featured
                ? "border-cyan-200/[0.22] bg-cyan-200/[0.08] text-cyan-200"
                : "border-blue-300/[0.12] bg-blue-400/[0.045] text-blue-300",
            ].join(" ")}
          >
            <Icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="min-h-[32px] text-[10px] font-semibold uppercase leading-4 tracking-[0.11em] text-slate-600">
              {plan.eyebrow}
            </p>
            <h3 className="mt-1 text-xl font-semibold tracking-[-0.025em] text-white">
              {plan.name}
            </h3>
          </div>
        </div>

        <div className="mt-7 flex items-end gap-2">
          <span className="text-4xl font-semibold tracking-[-0.05em] text-white">
            {plan.price}
          </span>
          <span className="pb-1 text-sm text-slate-600">{plan.cadence}</span>
        </div>

        <p className="mt-4 min-h-[96px] text-sm leading-7 text-slate-400">
          {plan.description}
        </p>

        <div className="mt-6 grid grid-cols-3 gap-2">
          <PlanMetric label="Inventory" value={plan.inventory} />
          <PlanMetric label="Decks" value={plan.decks} />
          <PlanMetric label="Seats" value={plan.seats} />
        </div>

        <div className="my-6 h-px bg-gradient-to-r from-transparent via-white/[0.09] to-transparent" />

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.13em] text-slate-600">
            Included
          </p>
          <div className="mt-4 space-y-3">
            {plan.features.map((feature) => (
              <div key={feature} className="flex items-start gap-3">
                <span
                  className={[
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    plan.featured
                      ? "bg-cyan-200/[0.1] text-cyan-200"
                      : "bg-blue-400/[0.07] text-blue-300",
                  ].join(" ")}
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-sm leading-6 text-slate-300">
                  {feature}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <Link
        href={plan.href}
        className={[
          "relative mt-auto inline-flex h-12 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition duration-200",
          plan.featured
            ? "bg-gradient-to-r from-blue-500 to-cyan-300 text-[#020914] shadow-[0_16px_38px_rgba(37,99,235,.26)] hover:-translate-y-0.5"
            : "border border-white/[0.09] bg-white/[0.025] text-white hover:-translate-y-0.5 hover:border-blue-300/[0.2] hover:bg-blue-400/[0.055]",
        ].join(" ")}
      >
        {plan.cta}
        <ChevronRight className="h-4 w-4" />
      </Link>
    </article>
  );
}

function PlanMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/[0.14] px-3 py-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-700">
        {label}
      </p>
      <p className="mt-1 break-words text-sm font-semibold leading-5 text-slate-100">
        {value}
      </p>
    </div>
  );
}
