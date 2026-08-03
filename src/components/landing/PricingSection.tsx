"use client";

import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Boxes,
  Building2,
  Check,
  ChevronRight,
  Crown,
  Database,
  Layers3,
  LineChart,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  Store,
  Users,
  WandSparkles,
} from "lucide-react";

import styles from "./LandingMotion.module.css";

type PlanCard = {
  id: "free" | "collector" | "seller" | "store";
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

const plans: PlanCard[] = [
  {
    id: "free",
    name: "Free",
    eyebrow: "Start organizing",
    price: "$0",
    cadence: "forever",
    description:
      "Build a clean foundation for a personal collection with essential inventory and deck tools.",
    inventory: "500",
    decks: "10",
    seats: "1",
    features: [
      "Personal dashboard",
      "Inventory organization",
      "Deck Vault",
      "Settings and support",
    ],
    icon: Layers3,
    href: "/signup?plan=free",
    cta: "Start free",
  },
  {
    id: "collector",
    name: "Collector",
    eyebrow: "For serious collectors",
    price: "$12",
    cadence: "per month",
    description:
      "Track a growing collection with richer limits, value history, analytics, and flexible CSV workflows.",
    inventory: "10,000",
    decks: "50",
    seats: "1",
    features: [
      "Collection analytics",
      "Value and growth history",
      "CSV Conversion Engine",
      "CSV import and export",
    ],
    icon: BarChart3,
    href: "/signup?plan=collector",
    cta: "Choose Collector",
  },
  {
    id: "seller",
    name: "Seller",
    eyebrow: "Run an online card business",
    price: "$39",
    cadence: "per month",
    description:
      "Manage purchasing, customers, marketplaces, orders, and automation from one seller workspace.",
    inventory: "50,000",
    decks: "Unlimited",
    seats: "1",
    features: [
      "Purchasing Intelligence",
      "Customer CRM and loyalty",
      "Marketplaces and orders",
      "Card Shows and automation",
    ],
    icon: PackageSearch,
    href: "/signup?plan=seller",
    cta: "Start selling",
    featured: true,
    badge: "Most popular",
  },
  {
    id: "store",
    name: "Store",
    eyebrow: "Operate a full storefront",
    price: "$99",
    cadence: "per month",
    description:
      "Run daily store operations with business intelligence, team controls, vendors, tournaments, and payroll.",
    inventory: "250,000",
    decks: "Unlimited",
    seats: "5 included",
    features: [
      "Business Intelligence",
      "Tasks, calendar, and tournaments",
      "Vendors and supply orders",
      "Employees, payroll, and finances",
    ],
    icon: Building2,
    href: "/signup?plan=store",
    cta: "Choose Store",
  },
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
      className="relative overflow-hidden border-y border-white/[0.05] bg-[#020914] px-4 py-24 sm:px-6 lg:px-8"
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

        <div className="mt-12 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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

        <div className="mt-10 flex flex-col items-center justify-between gap-5 rounded-[28px] border border-blue-300/[0.12] bg-gradient-to-r from-blue-500/[0.07] via-white/[0.025] to-cyan-300/[0.045] px-6 py-6 sm:flex-row sm:px-8">
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
            className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-blue-300/[0.18] bg-[#07121f] px-5 text-sm font-semibold text-blue-100 transition hover:-translate-y-0.5 hover:border-blue-300/[0.32] hover:bg-blue-400/[0.08]"
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
        `${styles.shimmer} td-spotlight-card group relative flex min-h-[650px] flex-col overflow-hidden rounded-[30px] border p-5 transition duration-300 sm:p-6`,
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
